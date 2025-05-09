#!/bin/bash
set -e
rm -f ./src/.env || true
export AWS_SDK_LOAD_CONFIG=1

echo "Setting up webapp environment variables..."

# Prompt for AWS region selection
echo -e "\n=== AWS Region Selection ==="
echo "1) us-east-1 (N. Virginia)"
echo "2) us-west-2 (Oregon)"
read -p "Select a region [2]: " region_choice

if [ -z "$region_choice" ] || [ "$region_choice" = "2" ]; then
  ENV_REGION="us-west-2"
  echo "Selected region: $ENV_REGION"
elif [ "$region_choice" = "1" ]; then
  ENV_REGION="us-east-1"
  echo "Selected region: $ENV_REGION"
else
  ENV_REGION="us-west-2"
  echo "Invalid selection, using default region: $ENV_REGION"
fi

# Project name prefix
ENV_PREFIX="mac-demo"
echo "Using project prefix: $ENV_PREFIX"

# Helper function to get a CloudFormation export
get_export() {
  aws cloudformation \
    --region ${ENV_REGION} \
    list-exports \
    --query "Exports[?Name=='${ENV_PREFIX}-${1}'].[Value]" \
    --output text
}

# Helper function to get a value from SSM Parameter Store
get_param() {
  aws ssm get-parameter \
    --region ${ENV_REGION} \
    --name "${1}" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text
}

# ------------------------------------------------
# Create local .env file in ./src/.env
# ------------------------------------------------

# Project name
echo "VITE_PROJECT_NAME=$ENV_PREFIX" >> ./src/.env

# Region
echo "VITE_REGION=$ENV_REGION" >> ./src/.env

# Cognito
echo "VITE_CONFIG_COGNITO_IDENTITYPOOL_ID=$(get_export config-cognito-identitypool-id)" >> ./src/.env
echo "VITE_CONFIG_COGNITO_USERPOOL_ID=$(get_export config-cognito-userpool-id)" >> ./src/.env
echo "VITE_CONFIG_COGNITO_APPCLIENT_ID=$(get_export config-cognito-appclient-id)" >> ./src/.env
echo "VITE_CONFIG_COGNITO_DOMAIN=$(get_export config-cognito-domain)" >> ./src/.env

# For callback URL, simplified approach
if [ "$NODE_ENV" = "production" ] || [ "$DEPLOYMENT_ENV" = "production" ]; then
  echo "Production deployment detected - setting CloudFront domain as callback URL"
  
  # Try to get the real domain from the CloudFront distribution
  CLOUDFRONT_DOMAIN=$(get_export config-website-distribution-domain 2>/dev/null || echo "")
  if [ ! -z "$CLOUDFRONT_DOMAIN" ]; then
    echo "Found CloudFront domain: $CLOUDFRONT_DOMAIN"
    CALLBACK_URL="https://$CLOUDFRONT_DOMAIN"
  else
    # Fallback to trying SSM parameter where deploy-website.sh stores it
    CLOUDFRONT_DOMAIN=$(get_param "/cloudfront-domain" 2>/dev/null || echo "")
    if [ ! -z "$CLOUDFRONT_DOMAIN" ]; then
      echo "Found CloudFront domain in SSM: $CLOUDFRONT_DOMAIN"
      CALLBACK_URL="https://$CLOUDFRONT_DOMAIN"
    else
      # If all else fails, use localhost as fallback
      CALLBACK_URL="http://localhost:3000"
      echo "Could not determine CloudFront domain, using localhost as callback URL"
    fi
  fi
else
  # Development mode - use localhost
  CALLBACK_URL="http://localhost:3000"
  echo "Development mode - using $CALLBACK_URL as callback URL"
fi

echo "Setting Cognito callback URL to: $CALLBACK_URL"
echo "VITE_CONFIG_COGNITO_CALLBACK_URL=$CALLBACK_URL" >> ./src/.env

# HTTP API Endpoint Url
echo "VITE_CONFIG_HTTP_API_URL=$(get_export config-apigateway-api-url-output)" >> ./src/.env

# REST API Endpoint Url
echo "VITE_CONFIG_REST_API_URL=$(get_export config-apigateway-rest-api-url-output)" >> ./src/.env

# S3 data bucket
echo "VITE_CONFIG_S3_DATA_BUCKET_NAME=$(get_export config-s3-data-bucket-name)" >> ./src/.env

# WebSocketID
echo "Retrieving WebSocket ID..."
WEBSOCKET_ID=$(get_param "/websocketid" 2>/dev/null || echo "")
if [ -z "$WEBSOCKET_ID" ]; then
  echo "WARNING: WebSocket ID not found in SSM Parameter Store, using placeholder"
  WEBSOCKET_ID="placeholder-websocket-id"
fi
echo "VITE_WEBSOCKETID_ID=$WEBSOCKET_ID" >> ./src/.env

# Add auth token - use a default that matches Lambda environment variable
echo "VITE_AUTH_TOKEN=mac-demo-auth-token" >> ./src/.env

# ------------------------------------------------
# Retrieve Bedrock agent IDs
# ------------------------------------------------
echo "Retrieving Bedrock agent IDs..."
# Try the correct parameter path that's used in main_agent_create Lambda
ALIAS_NAME="supe_alias"
SUPERVISOR_VALUE=$(get_param "/supervisor/${ALIAS_NAME}/agent-alias_id" 2>/dev/null || echo "/")
if [ "$SUPERVISOR_VALUE" = "/" ] || [ -z "$SUPERVISOR_VALUE" ]; then
  # Try the original parameter path as fallback
  SUPERVISOR_VALUE=$(get_param "/supervisorids" 2>/dev/null || echo "/")
  if [ "$SUPERVISOR_VALUE" = "/" ] || [ -z "$SUPERVISOR_VALUE" ]; then
    echo "WARNING: Supervisor IDs not found in SSM Parameter Store, using placeholders"
    AGENT_ID="placeholder-agent-id"
    ALIAS_ID="placeholder-alias-id"
  else
    AGENT_ID=$(echo "$SUPERVISOR_VALUE" | cut -d'/' -f1)
    ALIAS_ID=$(echo "$SUPERVISOR_VALUE" | cut -d'/' -f2)
  fi
else
  AGENT_ID=$(echo "$SUPERVISOR_VALUE" | cut -d'/' -f1)
  ALIAS_ID=$(echo "$SUPERVISOR_VALUE" | cut -d'/' -f2)
  echo "Found supervisor agent IDs: ${AGENT_ID}/${ALIAS_ID}"
fi

echo "VITE_SUPERVISOR_AGENT_ID=$AGENT_ID" >> ./src/.env
echo "VITE_SUPERVISOR_ALIAS_ID=$ALIAS_ID" >> ./src/.env

# ------------------------------------------------
# Create a small JS file to set localStorage in the browser
# ------------------------------------------------
cat << EOF > ./src/setLocalStorage.js
console.log("Setting agentId and aliasId into localStorage...");
window.localStorage.setItem('agentId', '$AGENT_ID');
window.localStorage.setItem('aliasId', '$ALIAS_ID');
window.localStorage.setItem('websocketId', '$WEBSOCKET_ID');
EOF

echo "webapp env file created successfully!"
cat ./src/.env

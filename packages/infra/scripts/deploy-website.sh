#!/bin/bash
set -e

echo "Deploying website to S3 and CloudFront..."

# Get region from AWS CLI config or use default
ENV_REGION=$(aws configure get region)
if [ -z "$ENV_REGION" ]; then
  ENV_REGION="us-west-2"
fi

# Project name prefix
ENV_PREFIX="mac-demo"

echo "Using region: $ENV_REGION"
echo "Using project prefix: $ENV_PREFIX"

# Helper function to get CloudFormation exports
get_export() {
  aws cloudformation --region "${ENV_REGION}" list-exports --query "Exports[?Name=='${ENV_PREFIX}-${1}'].[Value]" --output text
}

# Get S3 bucket name for website
WEBSITE_BUCKET=$(get_export config-website-s3-bucket-name)
if [ -z "$WEBSITE_BUCKET" ]; then
  echo "Error: Could not find S3 bucket for website. Make sure the stack has been deployed."
  exit 1
fi
echo "Deploying to S3 bucket: $WEBSITE_BUCKET"

# Get CloudFront distribution ID
DISTRIBUTION_ID=$(get_export config-website-distribution-id)
if [ -z "$DISTRIBUTION_ID" ]; then
  echo "Error: Could not find CloudFront distribution ID. Make sure the stack has been deployed."
  exit 1
fi
echo "Using CloudFront distribution ID: $DISTRIBUTION_ID"

# Get CloudFront domain name for Cognito callback URL
CLOUDFRONT_DOMAIN=$(get_export config-website-distribution-domain)
if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo "Warning: Could not find CloudFront domain name. Cognito callback URL may not be set correctly."
else
  echo "Using CloudFront domain name for Cognito callback URL: $CLOUDFRONT_DOMAIN"
  # Store the domain in SSM for the webapp env generation to use
  aws ssm put-parameter --name "/cloudfront-domain" --value "$CLOUDFRONT_DOMAIN" --type "String" --overwrite --region "$ENV_REGION"
fi

# Locate the webapp dist directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
POSSIBLE_DIST_DIRS=(
  "${SCRIPT_DIR}/../../webapp/dist"
  "${SCRIPT_DIR}/../webapp/dist"
  "${SCRIPT_DIR}/../../packages/webapp/dist"
)

WEBAPP_DIST_DIR=""
for dir in "${POSSIBLE_DIST_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    WEBAPP_DIST_DIR="$dir"
    echo "Found webapp dist directory at: $WEBAPP_DIST_DIR"
    break
  fi
done

if [ -z "$WEBAPP_DIST_DIR" ]; then
  echo "Error: Could not find webapp dist directory. Please build the webapp first with 'npm run build-webapp'"
  exit 1
fi

# Create a directory listing of the dist directory to verify contents
echo "Contents of dist directory:"
ls -la "$WEBAPP_DIST_DIR"

# Fix for the trailing colon in the bucket name
# Extract just the bucket name without s3://
BUCKET_NAME=$(echo "$WEBSITE_BUCKET" | sed 's|^s3://||')
echo "Using bucket name: $BUCKET_NAME"

# Upload the files using the AWS CLI directly (no changing directories)
echo "Uploading files to S3..."
find "$WEBAPP_DIST_DIR" -type f | while read -r file; do
  # Get the relative path from the dist directory
  rel_path="${file#$WEBAPP_DIST_DIR/}"
  echo "Uploading $rel_path..."
  aws s3 cp "$file" "s3://$BUCKET_NAME/$rel_path"
done

# Create CloudFront invalidation to clear cache
echo "Creating CloudFront invalidation..."
if [ -z "$DISTRIBUTION_ID" ]; then
    DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, '$CLOUDFRONT_DOMAIN')].Id" --output text)
fi

if [ ! -z "$DISTRIBUTION_ID" ]; then
    echo "Found distribution ID: $DISTRIBUTION_ID"
    # Create invalidation for both root and all paths
    aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" "/" "/index.html"
    echo "Created invalidation for distribution $DISTRIBUTION_ID"
    
    # Verify the origin path of the distribution
    ORIGIN_PATH=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query "Distribution.DistributionConfig.Origins.Items[0].OriginPath" --output text)
    if [ "$ORIGIN_PATH" != "" ]; then
        echo "Warning: Origin path is set to '$ORIGIN_PATH'. This might cause routing issues."
    fi
else
    echo "Error: Could not find CloudFront distribution. Please check your configuration."
    exit 1
fi

# Print deployment debug info
echo "Deployment Debug Information:"
echo "----------------------------"
echo "Distribution ID: $DISTRIBUTION_ID"
echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "S3 Bucket: $BUCKET_NAME"
echo "Origin Path: $ORIGIN_PATH"

# Verify the deployment
echo "Verifying website access..."
CF_DOMAIN=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.DomainName' --output text)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$CF_DOMAIN/")
if [ "$HTTP_CODE" = "200" ]; then
    echo "Website deployed successfully!"
else
    echo "Warning: Website returned HTTP $HTTP_CODE - check configuration"
fi

echo "Website deployment complete!"
echo "Website URL: https://$(get_export config-website-distribution-domain)"
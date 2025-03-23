#!/bin/bash

# Comprehensive cleanup and rollback script for mac-demo-customer-support stack
# This script handles pre-destruction cleanup of resources to ensure proper deletion

# Don't exit on error, we want to continue even if some resources fail
# set -e 
set +e
set -o pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Prefixes and names
STACK_PREFIX="mac-demo"
BASE_STACK_NAME="mac-demo-pipelineStack-dev"
DDB_TABLE_NAME="mac-demo-table"
REGION=$(aws configure get region)

if [ -z "$REGION" ]; then
    # Default to us-west-2 if no region is configured
    REGION="us-west-2"
fi

echo -e "${BLUE}Using AWS region: ${REGION}${NC}"

# Prompt for confirmation
echo -e "${RED}WARNING: This script will delete all resources created by the mac-demo stack${NC}"
echo -e "${YELLOW}It will empty S3 buckets, delete Lambda functions, and remove all CloudFront distributions${NC}"
read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${GREEN}Rollback canceled.${NC}"
    exit 0
fi

echo -e "${BLUE}Starting rollback process...${NC}"

# Function to check if a stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name $1 >/dev/null 2>&1
    return $?
}

# Function to handle errors and continue
handle_error() {
    local resource_type=$1
    local resource_id=$2
    local operation=$3
    
    echo -e "${YELLOW}Warning: Failed to $operation $resource_type: $resource_id${NC}"
    echo -e "${BLUE}Continuing with next resource...${NC}"
    # Don't exit, just continue
    return 0
}

# Step 1: Empty all S3 buckets
echo -e "${YELLOW}STEP 1: Emptying S3 buckets...${NC}"

# Find all buckets with the stack name prefix
BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, '${STACK_PREFIX}')].Name" --output text)

if [ -z "$BUCKETS" ]; then
    echo "No S3 buckets found with prefix ${STACK_PREFIX}"
else
    for BUCKET in $BUCKETS; do
        echo "Emptying bucket: $BUCKET"
        # First check if bucket exists
        if aws s3api head-bucket --bucket $BUCKET 2>/dev/null; then
            # Remove all versions (for versioned buckets)
            echo "Removing all objects and versions..."
            aws s3api list-object-versions --bucket $BUCKET --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json | \
                grep -v "null" > /tmp/delete_keys.json
            if [ -s /tmp/delete_keys.json ]; then
                sed -i'' -e 's/"Objects"/"Objects": /' /tmp/delete_keys.json
                sed -i'' -e 's/}/}, "Quiet": true/' /tmp/delete_keys.json
                aws s3api delete-objects --bucket $BUCKET --delete file:///tmp/delete_keys.json || true
            fi
            
            # Delete delete markers
            aws s3api list-object-versions --bucket $BUCKET --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json | \
                grep -v "null" > /tmp/delete_markers.json
            if [ -s /tmp/delete_markers.json ]; then
                sed -i'' -e 's/"Objects"/"Objects": /' /tmp/delete_markers.json
                sed -i'' -e 's/}/}, "Quiet": true/' /tmp/delete_markers.json
                aws s3api delete-objects --bucket $BUCKET --delete file:///tmp/delete_markers.json || true
            fi
            
            # Delete remaining objects (for non-versioned objects)
            echo "Removing standard objects..."
            aws s3 rm s3://$BUCKET --recursive || true
            
            echo "Bucket $BUCKET emptied"
        else
            echo "Bucket $BUCKET does not exist, skipping"
        fi
    done
fi

# Step 2: Delete all Lambda functions and layers
echo -e "${YELLOW}STEP 2: Deleting Lambda functions and layers...${NC}"

# Find all Lambda functions with the stack name prefix
LAMBDA_FUNCTIONS=$(aws lambda list-functions --query "Functions[?contains(FunctionName, '${STACK_PREFIX}')].FunctionName" --output text)

if [ -z "$LAMBDA_FUNCTIONS" ]; then
    echo "No Lambda functions found with prefix ${STACK_PREFIX}"
else
    for FUNC in $LAMBDA_FUNCTIONS; do
        echo "Deleting Lambda function: $FUNC"
        aws lambda delete-function --function-name $FUNC || true
    done
fi

# Check specifically for the layer creator function
LAYER_CREATOR=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'LayerCreator')].FunctionName" --output text)
if [ -n "$LAYER_CREATOR" ]; then
    for FUNC in $LAYER_CREATOR; do
        echo "Deleting layer creator function: $FUNC"
        aws lambda delete-function --function-name $FUNC || true
    done
fi

# Find and delete Lambda layers
echo "Finding and deleting Lambda layers..."
LAMBDA_LAYERS=$(aws lambda list-layers --query "Layers[?contains(LayerName, '${STACK_PREFIX}') || contains(LayerName, 'layer-boto3') || contains(LayerName, 'WsLayer')].LayerName" --output text)

if [ -z "$LAMBDA_LAYERS" ]; then
    echo "No Lambda layers found with relevant names"
else
    for LAYER in $LAMBDA_LAYERS; do
        echo "Getting latest version for layer: $LAYER"
        LATEST_VERSION=$(aws lambda list-layer-versions --layer-name $LAYER --query "LayerVersions[0].Version" --output text 2>/dev/null || echo "")
        
        if [ -n "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "None" ]; then
            echo "Deleting Lambda layer: $LAYER version $LATEST_VERSION"
            aws lambda delete-layer-version --layer-name $LAYER --version-number $LATEST_VERSION || true
            
            # Check for additional versions
            OTHER_VERSIONS=$(aws lambda list-layer-versions --layer-name $LAYER --query "LayerVersions[?Version!=$LATEST_VERSION].Version" --output text)
            if [ -n "$OTHER_VERSIONS" ]; then
                for VERSION in $OTHER_VERSIONS; do
                    echo "Deleting Lambda layer: $LAYER version $VERSION"
                    aws lambda delete-layer-version --layer-name $LAYER --version-number $VERSION || true
                done
            fi
        fi
    done
fi

# Step 3: Disable delete protection on DynamoDB tables
echo -e "${YELLOW}STEP 3: Disabling DynamoDB delete protection...${NC}"

DDB_TABLES=$(aws dynamodb list-tables --query "TableNames[?contains(@, '${STACK_PREFIX}')]" --output text)
if [ -z "$DDB_TABLES" ]; then
    echo "No DynamoDB tables found with prefix ${STACK_PREFIX}"
else
    for TABLE in $DDB_TABLES; do
        echo "Disabling delete protection for table: $TABLE"
        aws dynamodb update-table --table-name $TABLE --no-deletion-protection-enabled || true
    done
fi

# Specific check for mac-demo-table
if aws dynamodb describe-table --table-name $DDB_TABLE_NAME 2>/dev/null; then
    echo "Disabling delete protection for table: $DDB_TABLE_NAME"
    aws dynamodb update-table --table-name $DDB_TABLE_NAME --no-deletion-protection-enabled || true
fi

# Step 4: Disable CloudFront distributions
echo -e "${YELLOW}STEP 4: Disabling CloudFront distributions...${NC}"

# Find all distributions with the stack name prefix in their comment or tags
CF_DISTRIBUTIONS=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment, '${STACK_PREFIX}') || contains(to_string(Tags.Items), '${STACK_PREFIX}')].Id" --output text)

if [ -z "$CF_DISTRIBUTIONS" ]; then
    echo "No CloudFront distributions found with prefix ${STACK_PREFIX}"
else
    for DIST_ID in $CF_DISTRIBUTIONS; do
        echo "Processing CloudFront distribution: $DIST_ID"
        
        # Get the current distribution config
        aws cloudfront get-distribution-config --id $DIST_ID > /tmp/cf_config.json
        ETAG=$(jq -r '.ETag' /tmp/cf_config.json)
        
        # Extract and modify the distribution config
        jq '.DistributionConfig.Enabled = false' /tmp/cf_config.json > /tmp/cf_disabled.json
        DISABLED_CONFIG=$(jq '.DistributionConfig' /tmp/cf_disabled.json)
        
        # Update the distribution to disable it
        echo "Disabling distribution $DIST_ID..."
        if ! aws cloudfront update-distribution --id $DIST_ID --if-match $ETAG --distribution-config "$DISABLED_CONFIG" > /dev/null; then
            handle_error "CloudFront Distribution" "$DIST_ID" "disable"
            continue
        fi
        
        echo "Waiting for distribution $DIST_ID to be ready for deletion (this may take 10+ minutes)..."
        # Set timeout for distribution deployment (15 minutes)
        TIMEOUT=900
        ELAPSED=0
        INTERVAL=30
        
        while true; do
            STATUS=$(aws cloudfront get-distribution --id $DIST_ID --query "Distribution.Status" --output text 2>/dev/null || echo "ERROR")
            if [ "$STATUS" == "Deployed" ]; then
                break
            elif [ "$STATUS" == "ERROR" ]; then
                echo "Error getting distribution status. Moving on..."
                break
            fi
            
            echo "Status: $STATUS - waiting for deployment to complete..."
            sleep $INTERVAL
            
            # Check timeout
            ELAPSED=$((ELAPSED + INTERVAL))
            if [ $ELAPSED -ge $TIMEOUT ]; then
                echo "Timeout waiting for distribution deployment. Attempting deletion anyway..."
                break
            fi
        done
        
        # Delete the distribution
        echo "Deleting CloudFront distribution $DIST_ID..."
        NEW_ETAG=$(aws cloudfront get-distribution --id $DIST_ID --query "ETag" --output text 2>/dev/null || echo "")
        if [ -z "$NEW_ETAG" ]; then
            echo "Unable to get distribution ETag. Moving on..."
            continue
        fi
        
        if ! aws cloudfront delete-distribution --id $DIST_ID --if-match $NEW_ETAG; then
            handle_error "CloudFront Distribution" "$DIST_ID" "delete"
        fi
    done
fi

# Step 5: Delete OpenSearch Serverless resources
echo -e "${YELLOW}STEP 5: Deleting OpenSearch Serverless resources...${NC}"

# Find and delete OpenSearch Serverless collections
echo "Checking for OpenSearch Serverless collections..."
OS_COLLECTIONS=$(aws opensearch-serverless list-collections --query "collectionSummaries[?contains(name, '${STACK_PREFIX}')].id" --output text)

if [ -n "$OS_COLLECTIONS" ]; then
    for COLLECTION_ID in $OS_COLLECTIONS; do
        echo "Processing OpenSearch Serverless collection: $COLLECTION_ID"
        
        # Get collection details
        COLLECTION_NAME=$(aws opensearch-serverless get-collection --id $COLLECTION_ID --query "collection.name" --output text)
        echo "Collection name: $COLLECTION_NAME"
        
        # Check if collection has any indexes
        echo "Checking for indexes in collection..."
        
        # Get collection endpoint
        COLLECTION_ENDPOINT=$(aws opensearch-serverless get-collection --id $COLLECTION_ID --query "collection.collectionEndpoint" --output text)
        if [ -n "$COLLECTION_ENDPOINT" ]; then
            echo "Collection endpoint: $COLLECTION_ENDPOINT"
            
            # We could delete indexes here, but it's often not necessary and collection deletion will handle it
            echo "Relying on collection deletion to remove indexes"
        fi
        
        # Delete security policies associated with the collection
        echo "Deleting security policies for collection..."
        
        # Data access policy
        DATA_POLICIES=$(aws opensearch-serverless list-access-policies --type data --query "accessPolicySummaries[?resource=='collection/$COLLECTION_ID'].name" --output text)
        for POLICY in $DATA_POLICIES; do
            echo "Deleting data access policy: $POLICY"
            aws opensearch-serverless delete-access-policy --name $POLICY --type data || true
        done
        
        # Network policy
        NETWORK_POLICIES=$(aws opensearch-serverless list-access-policies --type network --query "accessPolicySummaries[?resource=='collection/$COLLECTION_ID'].name" --output text)
        for POLICY in $NETWORK_POLICIES; do
            echo "Deleting network policy: $POLICY"
            aws opensearch-serverless delete-access-policy --name $POLICY --type network || true
        done
        
        # Delete collection
        echo "Deleting OpenSearch Serverless collection: $COLLECTION_NAME ($COLLECTION_ID)"
        if ! aws opensearch-serverless delete-collection --id $COLLECTION_ID; then
            handle_error "OpenSearch Collection" "$COLLECTION_ID" "delete"
            continue
        fi
        
        echo "Waiting for collection deletion to complete..."
        
        # Wait for collection to be deleted
        TIMEOUT=300  # 5 minutes timeout
        ELAPSED=0
        INTERVAL=10
        
        while true; do
            STATUS=$(aws opensearch-serverless batch-get-collection --ids $COLLECTION_ID --query "collectionDetails[0].status" --output text 2>/dev/null || echo "DELETED")
            if [ "$STATUS" == "DELETED" ] || [ "$STATUS" == "None" ]; then
                echo "Collection deleted successfully"
                break
            fi
            
            echo "Status: $STATUS - waiting for deletion to complete..."
            sleep $INTERVAL
            
            # Check timeout
            ELAPSED=$((ELAPSED + INTERVAL))
            if [ $ELAPSED -ge $TIMEOUT ]; then
                echo "Timeout waiting for collection deletion. Moving on..."
                break
            fi
        done
    done
else
    echo "No OpenSearch Serverless collections found with prefix ${STACK_PREFIX}"
fi

# Find and delete OpenSearch Serverless VPC endpoints
echo "Checking for OpenSearch Serverless VPC endpoints..."
OS_ENDPOINTS=$(aws opensearch-serverless list-vpc-endpoints --query "vpcEndpointSummaries[?contains(name, '${STACK_PREFIX}')].id" --output text)

if [ -n "$OS_ENDPOINTS" ]; then
    for ENDPOINT_ID in $OS_ENDPOINTS; do
        echo "Deleting OpenSearch Serverless VPC endpoint: $ENDPOINT_ID"
        aws opensearch-serverless delete-vpc-endpoint --id $ENDPOINT_ID || true
        
        # Wait for endpoint to be deleted
        TIMEOUT=300  # 5 minutes timeout
        ELAPSED=0
        INTERVAL=10
        
        while true; do
            STATUS=$(aws opensearch-serverless get-vpc-endpoint --id $ENDPOINT_ID --query "vpcEndpoint.status" --output text 2>/dev/null || echo "DELETED")
            if [ "$STATUS" == "DELETED" ] || [ "$STATUS" == "None" ]; then
                echo "VPC endpoint deleted successfully"
                break
            fi
            echo "Status: $STATUS - waiting for deletion to complete..."
            sleep $INTERVAL
            
            # Check timeout
            ELAPSED=$((ELAPSED + INTERVAL))
            if [ $ELAPSED -ge $TIMEOUT ]; then
                echo "Timeout waiting for VPC endpoint deletion. Moving on..."
                break
            fi
        done
    done
else
    echo "No OpenSearch Serverless VPC endpoints found with prefix ${STACK_PREFIX}"
fi

# Step 6: Delete Amazon Bedrock Agents & Knowledge Bases
echo -e "${YELLOW}STEP 6: Deleting Amazon Bedrock Agents and Knowledge Bases...${NC}"

# Find and delete Amazon Bedrock agents
echo "Checking for Amazon Bedrock agents..."
AGENTS=$(aws bedrock list-agents --query "agentSummaries[?contains(name, '${STACK_PREFIX}') || contains(name, 'mac-')].agentId" --output text 2>/dev/null || echo "")

if [ -n "$AGENTS" ]; then
    for AGENT_ID in $AGENTS; do
        echo "Processing Bedrock agent: $AGENT_ID"
        
        # Get agent details
        AGENT_NAME=$(aws bedrock get-agent --agent-id $AGENT_ID --query "agent.name" --output text 2>/dev/null || echo "Unknown")
        echo "Agent name: $AGENT_NAME"
        
        # Delete agent aliases first
        echo "Checking for agent aliases..."
        ALIASES=$(aws bedrock list-agent-aliases --agent-id $AGENT_ID --query "agentAliasSummaries[].agentAliasId" --output text 2>/dev/null || echo "")
        
        if [ -n "$ALIASES" ]; then
            for ALIAS_ID in $ALIASES; do
                echo "Deleting agent alias: $ALIAS_ID"
                aws bedrock delete-agent-alias --agent-id $AGENT_ID --agent-alias-id $ALIAS_ID || true
                
                # Wait briefly for alias deletion to complete
                sleep 5
            done
            
            echo "All aliases deleted for agent $AGENT_NAME"
        else
            echo "No aliases found for agent $AGENT_NAME"
        fi
        
        # Delete the agent
        echo "Deleting Bedrock agent: $AGENT_NAME ($AGENT_ID)"
        aws bedrock delete-agent --agent-id $AGENT_ID || true
        
        # Wait for agent deletion
        echo "Waiting for agent deletion to complete..."
        sleep 10
    done
else
    echo "No Bedrock agents found with prefix ${STACK_PREFIX}"
fi

# Find and delete Supervisor Agent (main agent)
echo "Checking for Supervisor/Main Agent..."
SUPERVISOR_AGENT=$(aws bedrock list-agents --query "agentSummaries[?contains(name, 'Supervisor') || contains(name, 'MainAgent')].agentId" --output text 2>/dev/null || echo "")

if [ -n "$SUPERVISOR_AGENT" ]; then
    for AGENT_ID in $SUPERVISOR_AGENT; do
        echo "Processing Supervisor/Main agent: $AGENT_ID"
        
        # Get agent details
        AGENT_NAME=$(aws bedrock get-agent --agent-id $AGENT_ID --query "agent.name" --output text 2>/dev/null || echo "Unknown")
        echo "Agent name: $AGENT_NAME"
        
        # Delete agent aliases first
        echo "Checking for agent aliases..."
        ALIASES=$(aws bedrock list-agent-aliases --agent-id $AGENT_ID --query "agentAliasSummaries[].agentAliasId" --output text 2>/dev/null || echo "")
        
        if [ -n "$ALIASES" ]; then
            for ALIAS_ID in $ALIASES; do
                echo "Deleting agent alias: $ALIAS_ID"
                aws bedrock delete-agent-alias --agent-id $AGENT_ID --agent-alias-id $ALIAS_ID || true
                
                # Wait briefly for alias deletion to complete
                sleep 5
            done
            
            echo "All aliases deleted for agent $AGENT_NAME"
        else
            echo "No aliases found for agent $AGENT_NAME"
        fi
        
        # Delete the agent
        echo "Deleting Supervisor/Main agent: $AGENT_NAME ($AGENT_ID)"
        aws bedrock delete-agent --agent-id $AGENT_ID || true
        
        # Wait for agent deletion
        echo "Waiting for agent deletion to complete..."
        sleep 10
    done
else
    echo "No Supervisor/Main agent found"
fi

# Find and delete Knowledge Bases
echo "Checking for Bedrock Knowledge Bases..."
KNOWLEDGE_BASES=$(aws bedrock list-knowledge-bases --query "knowledgeBaseSummaries[?contains(name, '${STACK_PREFIX}') || contains(name, 'mac-')].knowledgeBaseId" --output text 2>/dev/null || echo "")

if [ -n "$KNOWLEDGE_BASES" ]; then
    for KB_ID in $KNOWLEDGE_BASES; do
        echo "Processing Knowledge Base: $KB_ID"
        
        # Get KB details
        KB_NAME=$(aws bedrock get-knowledge-base --knowledge-base-id $KB_ID --query "knowledgeBase.name" --output text 2>/dev/null || echo "Unknown")
        echo "Knowledge Base name: $KB_NAME"
        
        # Delete data sources first
        echo "Checking for data sources..."
        DATA_SOURCES=$(aws bedrock list-data-sources --knowledge-base-id $KB_ID --query "dataSourceSummaries[].dataSourceId" --output text 2>/dev/null || echo "")
        
        if [ -n "$DATA_SOURCES" ]; then
            for DS_ID in $DATA_SOURCES; do
                echo "Deleting data source: $DS_ID"
                aws bedrock delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID || true
                
                # Wait briefly for data source deletion to complete
                sleep 5
            done
            
            echo "All data sources deleted for Knowledge Base $KB_NAME"
        else
            echo "No data sources found for Knowledge Base $KB_NAME"
        fi
        
        # Delete the knowledge base
        echo "Deleting Knowledge Base: $KB_NAME ($KB_ID)"
        aws bedrock delete-knowledge-base --knowledge-base-id $KB_ID || true
        
        # Wait for KB deletion
        echo "Waiting for Knowledge Base deletion to complete..."
        sleep 10
    done
else
    echo "No Knowledge Bases found with prefix ${STACK_PREFIX}"
fi

# Step 7: Delete all OpenSearch Serverless policies (not just those attached to collections)
echo -e "${YELLOW}STEP 7: Deleting all OpenSearch Serverless policies...${NC}"

# Delete all security policies
echo "Deleting security policies..."
SECURITY_POLICIES=$(aws opensearch-serverless list-security-policies --query "securityPolicyDetails[?contains(name, '${STACK_PREFIX}') || contains(name, 'mac-')].name" --output text 2>/dev/null || echo "")

if [ -n "$SECURITY_POLICIES" ]; then
    for POLICY in $SECURITY_POLICIES; do
        echo "Deleting security policy: $POLICY"
        aws opensearch-serverless delete-security-policy --name $POLICY --type encryption || true
        sleep 2
    done
else
    echo "No security policies found with prefix ${STACK_PREFIX}"
fi

# Delete all data access policies
echo "Deleting data access policies..."
DATA_POLICIES=$(aws opensearch-serverless list-access-policies --type data --query "accessPolicySummaries[?contains(name, '${STACK_PREFIX}') || contains(name, 'mac-')].name" --output text 2>/dev/null || echo "")

if [ -n "$DATA_POLICIES" ]; then
    for POLICY in $DATA_POLICIES; do
        echo "Deleting data access policy: $POLICY"
        aws opensearch-serverless delete-access-policy --name $POLICY --type data || true
        sleep 2
    done
else
    echo "No data access policies found with prefix ${STACK_PREFIX}"
fi

# Delete all network policies
echo "Deleting network policies..."
NETWORK_POLICIES=$(aws opensearch-serverless list-access-policies --type network --query "accessPolicySummaries[?contains(name, '${STACK_PREFIX}') || contains(name, 'mac-')].name" --output text 2>/dev/null || echo "")

if [ -n "$NETWORK_POLICIES" ]; then
    for POLICY in $NETWORK_POLICIES; do
        echo "Deleting network policy: $POLICY"
        aws opensearch-serverless delete-access-policy --name $POLICY --type network || true
        sleep 2
    done
else
    echo "No network policies found with prefix ${STACK_PREFIX}"
fi

# Step 8: Delete WAF WebACLs
echo -e "${YELLOW}STEP 8: Deleting WAF WebACLs...${NC}"

# Find and delete regional WAF WebACLs
echo "Checking for regional WAF WebACLs..."
REGIONAL_ACLS=$(aws wafv2 list-web-acls --scope REGIONAL --region $REGION --query "WebACLs[?contains(Name, '${STACK_PREFIX}')].{Name:Name,Id:Id}" --output text)

if [ -n "$REGIONAL_ACLS" ]; then
    while read -r ACL_NAME ACL_ID; do
        if [ -n "$ACL_ID" ]; then
            echo "Deleting regional WAF WebACL: $ACL_NAME ($ACL_ID)"
            
            # Get associated resources
            ASSOC=$(aws wafv2 list-resources-for-web-acl --web-acl-arn "arn:aws:wafv2:${REGION}:$(aws sts get-caller-identity --query 'Account' --output text):regional/webacl/${ACL_NAME}/${ACL_ID}" --region $REGION --resource-type APPLICATION_LOAD_BALANCER --output text)
            
            if [ -n "$ASSOC" ]; then
                echo "Disassociating resources from WebACL..."
                for RESOURCE in $ASSOC; do
                    aws wafv2 disassociate-web-acl --resource-arn $RESOURCE --region $REGION || true
                done
            fi
            
            # Delete WebACL
            aws wafv2 delete-web-acl --name $ACL_NAME --scope REGIONAL --id $ACL_ID --region $REGION --lock-token $(aws wafv2 get-web-acl --name $ACL_NAME --scope REGIONAL --id $ACL_ID --region $REGION --query "LockToken" --output text) || true
        fi
    done <<< "$REGIONAL_ACLS"
else
    echo "No regional WAF WebACLs found with prefix ${STACK_PREFIX}"
fi

# Find and delete global WAF WebACLs
echo "Checking for global WAF WebACLs..."
# Use us-east-1 for global WAF
GLOBAL_ACLS=$(aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1 --query "WebACLs[?contains(Name, '${STACK_PREFIX}')].{Name:Name,Id:Id}" --output text)

if [ -n "$GLOBAL_ACLS" ]; then
    while read -r ACL_NAME ACL_ID; do
        if [ -n "$ACL_ID" ]; then
            echo "Deleting global WAF WebACL: $ACL_NAME ($ACL_ID)"
            aws wafv2 delete-web-acl --name $ACL_NAME --scope CLOUDFRONT --id $ACL_ID --region us-east-1 --lock-token $(aws wafv2 get-web-acl --name $ACL_NAME --scope CLOUDFRONT --id $ACL_ID --region us-east-1 --query "LockToken" --output text) || true
        fi
    done <<< "$GLOBAL_ACLS"
else
    echo "No global WAF WebACLs found with prefix ${STACK_PREFIX}"
fi

# Step 9: Delete CDK stacks
echo -e "${YELLOW}STEP 9: Deleting CDK stacks and all CloudFormation stacks...${NC}"

# Check if CDK CLI is installed
if ! command -v cdk &> /dev/null; then
    echo "CDK CLI not found. Falling back to CloudFormation API for stack deletion."
    echo "Consider installing CDK CLI for more reliable stack deletion."
    
    # Find all nested stacks that match our prefix
    ALL_STACKS=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[?contains(StackName, '${STACK_PREFIX}')].StackName" --output text)
    
    echo "Found these stacks to delete:"
    for STACK in $ALL_STACKS; do
        echo "  - $STACK"
        aws cloudformation delete-stack --stack-name $STACK
        echo "Deletion initiated for stack $STACK"
    done
else
    # Get the current directory to return to it later
    CURRENT_DIR=$(pwd)
    
    # First attempt to delete with CDK
    # Navigate to the infra directory
    echo "Navigating to the infra directory..."
    cd "$(dirname "$0")/.." || { echo "Failed to navigate to infra directory"; exit 1; }
    
    # Execute CDK destroy with force flag to avoid confirmation prompts
    echo "Executing 'cdk destroy' to remove all stacks..."
    cdk destroy --all --force
    
    # Return to the original directory
    cd "$CURRENT_DIR" || { echo "Failed to return to original directory"; exit 1; }
    
    echo "CDK destroy completed."
    
    # Then delete any remaining stacks directly with CloudFormation API
    echo "Now checking for any remaining CloudFormation stacks to delete..."
    ALL_STACKS=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[?contains(StackName, '${STACK_PREFIX}')].StackName" --output text)
    
    if [ -n "$ALL_STACKS" ]; then
        echo "Found remaining stacks to delete:"
        for STACK in $ALL_STACKS; do
            echo "  - $STACK"
            aws cloudformation delete-stack --stack-name $STACK
            echo "Deletion initiated for stack $STACK"
        done
        
        echo "Waiting for stack deletions to complete..."
        for STACK in $ALL_STACKS; do
            aws cloudformation wait stack-delete-complete --stack-name $STACK
            echo "Stack $STACK deleted."
        done
    else
        echo "No remaining stacks found."
    fi
    
    # Check for nested stacks in mac-demo
    NESTED_STACKS=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[?contains(StackName, 'macdemopipelineStack')].StackName" --output text)
    
    if [ -n "$NESTED_STACKS" ]; then
        echo "Found nested stacks to delete:"
        for STACK in $NESTED_STACKS; do
            echo "  - $STACK"
            aws cloudformation delete-stack --stack-name $STACK
            echo "Deletion initiated for stack $STACK"
        done
        
        echo "Waiting for nested stack deletions to complete..."
        for STACK in $NESTED_STACKS; do
            aws cloudformation wait stack-delete-complete --stack-name $STACK
            echo "Stack $STACK deleted."
        done
    else
        echo "No nested stacks found."
    fi
fi

echo -e "${GREEN}Rollback process completed!${NC}"
echo -e "${YELLOW}NOTE: Some resources might still be in the process of being deleted.${NC}"
echo -e "${YELLOW}Check the AWS Console to ensure all resources are properly deleted.${NC}"
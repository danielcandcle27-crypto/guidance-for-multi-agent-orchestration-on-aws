#!/bin/bash
# Force delete a CloudFormation stack stuck in DELETE_FAILED state
# Usage: bash force-delete-stack.sh [stack-name] [region]

set -e

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Default stack name and region
STACK_NAME="dev-mac-demo-backend"
REGION="us-east-1"

# Override defaults if provided
if [ ! -z "$1" ]; then
    STACK_NAME="$1"
fi

if [ ! -z "$2" ]; then
    REGION="$2"
fi

echo -e "${GREEN}=== Forcing Deletion of Stack: $STACK_NAME in $REGION ===${NC}"

# Check if the stack exists and get its status
echo -e "${BLUE}Checking if stack exists and getting its status...${NC}"
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "STACK_NOT_FOUND")

if [ "$STACK_STATUS" == "STACK_NOT_FOUND" ]; then
    echo -e "${YELLOW}Stack $STACK_NAME doesn't exist in region $REGION.${NC}"
    exit 0
else
    echo -e "${GREEN}Stack $STACK_NAME exists with status: $STACK_STATUS${NC}"

    # If the stack is in DELETE_FAILED state, we need to find the resources that are causing the issue
    if [ "$STACK_STATUS" == "DELETE_FAILED" ]; then
        echo -e "${YELLOW}Stack is in DELETE_FAILED state. Finding resources that are causing issues...${NC}"
        
        # Get list of resources in the stack
        echo -e "${BLUE}Listing stack resources...${NC}"
        RESOURCES=$(aws cloudformation list-stack-resources --stack-name $STACK_NAME --region $REGION --query 'StackResourceSummaries[?ResourceStatus==`DELETE_FAILED`].LogicalResourceId' --output text)
        
        if [ -z "$RESOURCES" ]; then
            echo -e "${YELLOW}No resources found in DELETE_FAILED state. Will try to force delete anyway...${NC}"
            RETAIN_OPTION=""
        else
            echo -e "${YELLOW}The following resources are in DELETE_FAILED state:${NC}"
            echo -e "${RED}$RESOURCES${NC}"
            
            # Build retain-resources parameter
            RETAIN_OPTION="--retain-resources"
            for RESOURCE in $RESOURCES; do
                RETAIN_OPTION="$RETAIN_OPTION $RESOURCE"
            done
        fi
        
        # Force delete the stack with retain-resources option if needed
        echo -e "${BLUE}Attempting to delete stack with retain-resources option...${NC}"
        if [ -z "$RETAIN_OPTION" ]; then
            aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION
        else
            aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION $RETAIN_OPTION
        fi
        
        # Wait for stack deletion (it should succeed this time)
        echo -e "${BLUE}Waiting for stack deletion to complete...${NC}"
        aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $REGION || true
        
        # Check if stack still exists
        echo -e "${BLUE}Checking if stack still exists...${NC}"
        STACK_EXISTS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION 2>/dev/null && echo "yes" || echo "no")
        
        if [ "$STACK_EXISTS" == "yes" ]; then
            echo -e "${RED}Stack $STACK_NAME still exists. Manual cleanup may be required.${NC}"
            echo -e "${YELLOW}You might need to manually delete resources in the AWS Console.${NC}"
        else
            echo -e "${GREEN}Stack $STACK_NAME has been successfully deleted!${NC}"
        fi
    else
        echo -e "${YELLOW}Stack is not in DELETE_FAILED state. Current status: $STACK_STATUS${NC}"
        echo -e "${YELLOW}Attempting normal stack deletion...${NC}"
        
        aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION
        echo -e "${BLUE}Waiting for stack deletion to complete...${NC}"
        aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $REGION || true
        
        # Check if stack still exists
        STACK_EXISTS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION 2>/dev/null && echo "yes" || echo "no")
        
        if [ "$STACK_EXISTS" == "yes" ]; then
            echo -e "${RED}Stack $STACK_NAME couldn't be deleted normally.${NC}"
            echo -e "${YELLOW}You might need to try again with the --retain-resources option.${NC}"
        else
            echo -e "${GREEN}Stack $STACK_NAME has been successfully deleted!${NC}"
        fi
    fi
fi

# Check for any lingering Athena output bucket references that might cause future issues
echo -e "${BLUE}Checking for lingering Athena configuration issues...${NC}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
echo -e "${GREEN}AWS Account ID: $ACCOUNT_ID${NC}"

# Check Athena Workgroup configurations
echo -e "${BLUE}Checking Athena workgroup configurations...${NC}"
WORKGROUPS=$(aws athena list-work-groups --region $REGION --query 'WorkGroups[*].Name' --output text)

for WG in $WORKGROUPS; do
    echo -e "${BLUE}Checking workgroup: $WG${NC}"
    WG_CONFIG=$(aws athena get-work-group --work-group $WG --region $REGION --query 'WorkGroup.Configuration' --output json 2>/dev/null || echo "{}")
    
    # Check if this workgroup has a misconfigured output location
    OUTPUT_LOCATION=$(echo $WG_CONFIG | jq -r '.ResultConfiguration.OutputLocation // ""')
    
    if [[ $OUTPUT_LOCATION == *"genai-athena-output-bucket-misconfig"* ]]; then
        echo -e "${YELLOW}Found misconfigured Athena workgroup: $WG${NC}"
        echo -e "${YELLOW}Current output location: $OUTPUT_LOCATION${NC}"
        
        read -p "Do you want to update this workgroup to use a valid bucket location? (y/n): " CONFIRM
        if [[ $CONFIRM == [yY] || $CONFIRM == [yY][eE][sS] ]]; then
            # Update to use a valid bucket
            VALID_BUCKET="s3://${STACK_NAME}-athena-results-$ACCOUNT_ID/"
            echo -e "${YELLOW}Updating to use valid bucket: $VALID_BUCKET${NC}"
            
            aws athena update-work-group --region $REGION --work-group $WG \
                --configuration "{\"ResultConfiguration\":{\"OutputLocation\":\"$VALID_BUCKET\"},\"EnforceWorkGroupConfiguration\":true}" \
                || echo -e "${RED}Failed to update workgroup $WG. You may need to update it manually in the AWS Console.${NC}"
        fi
    fi
done

echo -e "${GREEN}=== CloudFormation Stack Deletion Process Complete ===${NC}"

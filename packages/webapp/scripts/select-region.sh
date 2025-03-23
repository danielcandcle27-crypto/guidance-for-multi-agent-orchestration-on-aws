#!/bin/bash
set -e

# Prompt for AWS region selection
echo -e "\n=== AWS Region Selection ==="
echo "1) us-east-1 (N. Virginia)"
echo "2) us-west-2 (Oregon)"
read -p "Select a region [2]: " region_choice

if [ -z "$region_choice" ] || [ "$region_choice" = "2" ]; then
  export AWS_REGION="us-west-2"
  echo "Selected region: $AWS_REGION"
elif [ "$region_choice" = "1" ]; then
  export AWS_REGION="us-east-1"
  echo "Selected region: $AWS_REGION"
else
  export AWS_REGION="us-west-2"
  echo "Invalid selection, using default region: $AWS_REGION"
fi

# Export AWS_REGION so it's available to subsequent commands
echo "export AWS_REGION=$AWS_REGION" > /tmp/aws-region-env.sh
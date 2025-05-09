#!/bin/bash

# Set your AWS region
REGION="us-west-2"

# Get list of all buckets
echo "Listing all S3 buckets..."
BUCKETS=$(aws s3api list-buckets --query "Buckets[].Name" --output text)

echo "Enabling block public access for all buckets..."
echo "------------------------------------------------------"

for BUCKET in $BUCKETS; do
  echo "Processing bucket: $BUCKET"
  
  # Enable block public access for the bucket
  echo "Enabling block public access for bucket: $BUCKET"
  aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  
  if [ $? -eq 0 ]; then
    echo "✅ Successfully enabled block public access for $BUCKET"
  else
    echo "❌ Failed to enable block public access for $BUCKET"
  fi
  echo "------------------------"
done

echo "All buckets processed."

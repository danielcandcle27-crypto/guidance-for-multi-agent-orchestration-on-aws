#!/bin/bash

# Set your AWS region
REGION="us-west-2"

# Create a logging bucket if you don't have one already
LOGGING_BUCKET="s3-access-logs-$(aws sts get-caller-identity --query Account --output text)"

# Check if logging bucket exists, if not create it
if ! aws s3api head-bucket --bucket $LOGGING_BUCKET 2>/dev/null; then
  echo "Creating logging bucket: $LOGGING_BUCKET"
  aws s3api create-bucket --bucket $LOGGING_BUCKET --region $REGION --create-bucket-configuration LocationConstraint=$REGION
  
  # Set appropriate permissions on the logging bucket
  aws s3api put-bucket-acl --bucket $LOGGING_BUCKET --grant-write URI=http://acs.amazonaws.com/groups/s3/LogDelivery --grant-read-acp URI=http://acs.amazonaws.com/groups/s3/LogDelivery
  
  # Block public access to the logging bucket
  aws s3api put-public-access-block --bucket $LOGGING_BUCKET --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
fi

# Get list of all buckets
echo "Listing all S3 buckets..."
BUCKETS=$(aws s3api list-buckets --query "Buckets[].Name" --output text)

# Check and enable logging for each bucket
for BUCKET in $BUCKETS; do
  echo "Checking bucket: $BUCKET"
  
  # Skip the logging bucket itself
  if [ "$BUCKET" == "$LOGGING_BUCKET" ]; then
    echo "Skipping logging bucket itself"
    continue
  fi
  
  # Check if logging is enabled
  LOGGING_STATUS=$(aws s3api get-bucket-logging --bucket $BUCKET)
  
  if [[ $LOGGING_STATUS == *"LoggingEnabled"* ]]; then
    echo "Logging already enabled for $BUCKET"
  else
    echo "Enabling logging for $BUCKET"
    
    # Define a prefix based on the bucket name
    PREFIX="${BUCKET}/"
    
    # Enable logging
    aws s3api put-bucket-logging --bucket $BUCKET --bucket-logging-status "{\"LoggingEnabled\":{\"TargetBucket\":\"$LOGGING_BUCKET\",\"TargetPrefix\":\"$PREFIX\"}}"
    
    if [ $? -eq 0 ]; then
      echo "Successfully enabled logging for $BUCKET"
    else
      echo "Failed to enable logging for $BUCKET"
    fi
  fi
  
  echo "------------------------"
done

echo "All buckets processed."

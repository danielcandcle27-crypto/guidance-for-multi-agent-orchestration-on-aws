#!/bin/bash

# Set your AWS region
REGION="us-west-2"

# Get list of all buckets
echo "Listing all S3 buckets..."
BUCKETS=$(aws s3api list-buckets --query "Buckets[].Name" --output text)

echo "Checking public access block settings for each bucket..."
echo "------------------------------------------------------"

# Arrays to track buckets
COMPLIANT_BUCKETS=()
NON_COMPLIANT_BUCKETS=()

for BUCKET in $BUCKETS; do
  echo "Checking bucket: $BUCKET"
  
  # Check public access block configuration
  PUBLIC_ACCESS_BLOCK=$(aws s3api get-public-access-block --bucket $BUCKET 2>/dev/null)
  
  if [ $? -eq 0 ]; then
    # Check if all block public access settings are enabled
    BLOCK_PUBLIC_ACLS=$(echo $PUBLIC_ACCESS_BLOCK | grep -c '"BlockPublicAcls": true')
    IGNORE_PUBLIC_ACLS=$(echo $PUBLIC_ACCESS_BLOCK | grep -c '"IgnorePublicAcls": true')
    BLOCK_PUBLIC_POLICY=$(echo $PUBLIC_ACCESS_BLOCK | grep -c '"BlockPublicPolicy": true')
    RESTRICT_PUBLIC_BUCKETS=$(echo $PUBLIC_ACCESS_BLOCK | grep -c '"RestrictPublicBuckets": true')
    
    if [ $BLOCK_PUBLIC_ACLS -eq 1 ] && [ $IGNORE_PUBLIC_ACLS -eq 1 ] && [ $BLOCK_PUBLIC_POLICY -eq 1 ] && [ $RESTRICT_PUBLIC_BUCKETS -eq 1 ]; then
      echo "✅ Bucket $BUCKET has all public access block settings enabled"
      COMPLIANT_BUCKETS+=("$BUCKET")
    else
      echo "❌ Bucket $BUCKET does not have all public access block settings enabled"
      NON_COMPLIANT_BUCKETS+=("$BUCKET")
    fi
  else
    echo "❌ Bucket $BUCKET does not have public access block configuration"
    NON_COMPLIANT_BUCKETS+=("$BUCKET")
  fi
  
  echo "------------------------"
done

# Summary
echo ""
echo "SUMMARY:"
echo "------------------------------------------------------"
echo "Total buckets checked: $((${#COMPLIANT_BUCKETS[@]} + ${#NON_COMPLIANT_BUCKETS[@]}))"
echo "Compliant buckets: ${#COMPLIANT_BUCKETS[@]}"
echo "Non-compliant buckets: ${#NON_COMPLIANT_BUCKETS[@]}"

# List non-compliant buckets
if [ ${#NON_COMPLIANT_BUCKETS[@]} -gt 0 ]; then
  echo ""
  echo "NON-COMPLIANT BUCKETS:"
  echo "------------------------------------------------------"
  for BUCKET in "${NON_COMPLIANT_BUCKETS[@]}"; do
    echo "$BUCKET"
  done
  
  # Ask if user wants to enable block public access for non-compliant buckets
  echo ""
  echo "Do you want to enable block public access for all non-compliant buckets? (y/n)"
  read -r ENABLE_BLOCK
  
  if [[ $ENABLE_BLOCK == "y" || $ENABLE_BLOCK == "Y" ]]; then
    echo ""
    echo "ENABLING BLOCK PUBLIC ACCESS:"
    echo "------------------------------------------------------"
    for BUCKET in "${NON_COMPLIANT_BUCKETS[@]}"; do
      echo "Enabling block public access for bucket: $BUCKET"
      aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
      
      if [ $? -eq 0 ]; then
        echo "✅ Successfully enabled block public access for $BUCKET"
      else
        echo "❌ Failed to enable block public access for $BUCKET"
      fi
      echo "------------------------"
    done
  fi
fi

echo "Check complete."

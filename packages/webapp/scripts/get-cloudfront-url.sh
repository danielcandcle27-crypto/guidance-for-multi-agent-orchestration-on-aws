#!/bin/bash

# Script to get the proper CloudFront URL for accessing the website

# Get environment variables
source "${SCRIPT_DIR}/accountConfig.js"

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "Error: DISTRIBUTION_ID not set"
    exit 1
fi

# Get CloudFront domain name
CF_DOMAIN=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.DomainName' --output text)
if [ -z "$CF_DOMAIN" ]; then
    echo "Error: Could not get CloudFront domain name"
    exit 1
fi

echo "Website URL: https://$CF_DOMAIN/"
echo "Note: Always use this URL to access the website, not the S3 bucket URL"

# Test access
echo "Testing access..."
curl -I "https://$CF_DOMAIN/" | grep -E "Server|x-cache|x-amz"
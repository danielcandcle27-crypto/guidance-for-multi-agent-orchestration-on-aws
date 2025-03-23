# Deployment Guide for MAC Demo Customer Support

This guide will help you deploy the Multi-Agent Collaboration (MAC) Customer Support application using public resources.

## Prerequisites

1. AWS Account with permissions to create resources
2. AWS CLI configured with credentials
3. Node.js (v18+)
4. Access to the following Amazon Bedrock models:
   - Claude 3 Haiku
   - Claude 3 Sonnet
   - Cohere Embed English

## Setup

1. Install dependencies:
   ```bash
   npm run install:all
   ```

2. Configure your AWS account credentials:
   ```bash
   aws configure
   ```

## Deployment Options

### Option 1: Deploy Everything at Once

To deploy all infrastructure and the web application in one command:

```bash
npm run deploy:all
```

### Option 2: Step-by-Step Deployment

1. Deploy the infrastructure:
   ```bash
   npm run deploy
   ```

2. Deploy the web application:
   ```bash
   npm run deploy:webapp
   ```

## What Gets Deployed

The deployment creates the following resources:

1. VPC and network infrastructure
2. WAF configuration for security
3. S3 buckets for data storage
4. Cognito user pool for authentication
5. API Gateway endpoints
6. Lambda functions for backend logic
7. Bedrock agents and knowledge bases
8. CloudFront distribution for web hosting

## Post-Deployment

After deployment completes:

1. The console will display the CloudFront URL for your web application
2. You can access the web application using this URL
3. Initial login credentials will be sent to your email

## Troubleshooting

If you encounter issues during deployment:

1. Check the CloudFormation console for detailed error messages
2. Ensure your AWS account has access to the required Bedrock models
3. Verify your IAM permissions allow creating all required resources
4. Check that your AWS CLI configuration is correct

## Cleanup

To remove all deployed resources:

```bash
npm run -w infra cdk destroy --all
```

Note: This will permanently delete all resources and data associated with the application.
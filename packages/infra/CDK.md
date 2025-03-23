# CDK Architecture Guide

This document provides an overview of the AWS CDK infrastructure for the Multi-Agent Collaboration (MAC) Customer Support demo.

## Stack Architecture

The MAC demo is structured as a set of modular CDK stacks that can be deployed together:

1. **VPC Stack** (`vpc-stack.ts`)
   - Creates VPC with public and private subnets
   - Sets up security groups and NAT gateways

2. **WAF Stack** (`waf-stack.ts`)
   - Configures AWS WAF for API Gateway and CloudFront protection
   - Sets up rate-limiting and basic security rules

3. **Website WAF Stack** (`website-waf-stack.ts`)
   - Creates CloudFront distribution for web hosting
   - Configures S3 bucket for static website assets

4. **Cognito Auth Stack** (`cognito-auth-stack.ts`)
   - Creates Cognito user pool and identity pool
   - Configures authentication for web application

5. **API Gateway Stacks**
   - HTTP API Gateway (`http-api-gateway-stack.ts`) for main API
   - REST API Gateway (`rest-api-gateway-stack.ts`) for WebSocket connections

6. **Data Bucket Stack** (`bucket-stack.ts`)
   - Creates S3 buckets for structured and unstructured data
   - Sets up Athena tables and query configuration

7. **Bedrock Agent Stack** (`agent-stack.ts`)
   - Creates Bedrock knowledge bases and agents
   - Configures agent actions and integration with data sources

## Deployment Flow

The infrastructure deployment follows this flow:

1. Foundation infrastructure (VPC, WAF)
2. Website and auth resources
3. API endpoints
4. Data storage
5. Agent configuration

## Key Components

### Bucket Naming

All S3 buckets follow the naming convention: `{projectName}-{purpose}-{awsAccount}`
- Example: `mac-demo-mac-data-str-123456789012`

### Parameters and Secrets

Important IDs and parameters are stored in:
- AWS SSM Parameter Store for runtime access
- CloudFormation exports for cross-stack references

### Authentication

- Web application uses Cognito
- WebSocket connections use token-based authentication
- Lambda execution roles have specific IAM permissions

## Local Development

For local development:
1. Use the `cdk.json` file for context information
2. Run `npm run synth` to verify CDK templates
3. Use `npm run simple-deploy` for deploying with default settings
4. Review deployment outputs for access URLs and IDs

## Customization

To customize the deployment:
1. Modify `AppConfig.ts` for project-level settings
2. Update individual stack parameters as needed
3. Use environment variables or AWS CLI profiles for credentials
4. Override defaults in deployment scripts

## Best Practices

- Keep stack dependencies clean and explicit
- Use consistent naming across resources
- Leverage parameterization for environment differences
- Follow infrastructure as code principles
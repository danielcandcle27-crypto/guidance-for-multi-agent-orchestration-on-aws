#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const { projectName } = require('../dist/config/AppConfig');
const path = require('path');
const fs = require('fs');
const { selectRegion } = require('./select-region');

/**
 * Simple deployment script that directly deploys CDK stacks without
 * the complexity of multi-account deployment or GitLab integration.
 */
async function deploy() {
  try {
    // Get current AWS account info
    let awsAccount, awsRegion;
    
    try {
      // Get account ID
      awsAccount = execSync('aws sts get-caller-identity --query Account --output text')
        .toString()
        .trim();
      
      // Prompt for region selection between us-west-2 (default) and us-east-1
      awsRegion = await selectRegion();
      
      console.log(`Using AWS Account: ${awsAccount}`);
      console.log(`Using AWS Region: ${awsRegion}`);
      
      // Set region for AWS CLI commands
      process.env.AWS_REGION = awsRegion;
    } catch (error) {
      console.error('Error getting AWS account information:', error.message);
      console.error('Make sure you have AWS CLI configured with valid credentials.');
      process.exit(1);
    }
    
    // Set environment variables for CDK
    process.env.CDK_DEFAULT_ACCOUNT = awsAccount;
    process.env.CDK_DEFAULT_REGION = awsRegion;
    
    // Ensure CDK is bootstrapped
    console.log(`Checking if environment is bootstrapped...`);
    try {
      execSync(`npx cdk bootstrap aws://${awsAccount}/${awsRegion}`, {
        stdio: 'inherit'
      });
      console.log('Bootstrap completed or already bootstrapped.');
    } catch (error) {
      console.error('Error bootstrapping CDK environment:', error.message);
      process.exit(1);
    }
    
    // Deploy the VPC and WAF stacks first
    console.log(`\nDeploying foundation stacks (VPC, WAF)...`);
    await cdkDeploy(`${projectName}*-vpc-stack ${projectName}*-waf-stack`);
    
    // Deploy the website and Cognito stacks
    console.log(`\nDeploying website and auth stacks...`);
    await cdkDeploy(`${projectName}*-website-waf-stack ${projectName}*-cognito-auth-stack`);
    
    // Deploy the API gateway stacks
    console.log(`\nDeploying API gateway stacks...`);
    await cdkDeploy(`${projectName}*-api-gateway-stack ${projectName}*-rest-api-gateway-stack`);
    
    // Deploy the data bucket stack
    console.log(`\nDeploying data bucket stack...`);
    await cdkDeploy(`${projectName}*-data-bucket-stack`);
    
    // Finally, deploy the agent stacks
    console.log(`\nDeploying agent stacks...`);
    await cdkDeploy(`${projectName}*-infra-agents`);
    
    console.log(`\n✅ Deployment completed successfully!`);
    console.log(`\nNext steps:`);
    console.log(`1. Generate environment variables: npm run -w webapp generate-env`);
    console.log(`2. Build and run the web application: npm run -w webapp build && npm run -w webapp dev`);
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

/**
 * Helper function to run CDK deploy with the specified stacks
 */
async function cdkDeploy(stackNames) {
  return new Promise((resolve, reject) => {
    const command = `npx cdk deploy ${stackNames} --require-approval never`;
    console.log(`Running: ${command}`);
    
    const child = spawn('npx', [`cdk`, `deploy`, ...stackNames.split(' '), `--require-approval`, `never`], {
      stdio: 'inherit',
      env: process.env,
      shell: true
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`CDK deployment failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

// Run the deployment
deploy().catch((err) => {
  console.error('Deployment script failed:', err.message);
  process.exit(1);
});
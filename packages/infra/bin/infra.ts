#!/usr/bin/env node
/************************************************************
 * infra.ts
 ************************************************************/
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';

// Example: import from your compiled config or from a TS file using ts-node
import { projectName, accountMappings } from '../config/AppConfig'; 

const app = new cdk.App();

// Only DEV environment is supported
const stageEnv = 'DEV';
const isDev = true;
console.log(`CDK INFRA: Using stageEnv = ${stageEnv}, isDev = ${isDev}`);

// 2) Look up the account from your TS config array
//    The account mapping will be shaped like: [{ type: 'DEV', account: '...' }]
const target = accountMappings.find(acct => acct.type === stageEnv);
if (!target) {
  console.error(`No account mapping found for ${stageEnv} in accountMappings`);
  process.exit(1);
}
console.log(`CDK INFRA: Found accountId: ${target.account}`);

// 3) Construct the stack name, e.g. "mac-demo-pipelineStack-prod"
const pipelineStackName = `${projectName}-pipelineStack-${stageEnv.toLowerCase()}`;
console.log(`CDK INFRA: Pipeline stack name = ${pipelineStackName}`);

// 4) Create your pipeline stack
const pipelineStack = new PipelineStack(app, pipelineStackName, {
  projectName,
  stage: stageEnv, // Add the required stage property
  dev: isDev,
  env: {
    // Use target.accountId, not target.account
    account: process.env.CDK_DEFAULT_ACCOUNT || target.account,
    region: process.env.CDK_DEFAULT_REGION || target.region || 'us-west-2',
  },
});

// Tag if desired
cdk.Tags.of(pipelineStack).add('project', projectName);

// Example cdk-nag usage
// cdk.Aspects.of(app).add(new AwsSolutionsChecks());
NagSuppressions.addStackSuppressions(pipelineStack, [
  {
    id: 'AwsSolutions-IAM5',
    reason: 'Wildcard in read-only role for S3 read access only.'
  },
  {
    id: 'AwsSolutions-S1',
    reason: 'CloudTrail S3 resource does not need access logs for this scenario.'
  },
  {
    id: 'AwsSolutions-CB4',
    reason: 'Disabling KMS usage for CodeBuild for now.'
  },
  {
    id: 'AwsSolutions-KMS5',
    reason: 'Key rotation disabled for CodePipeline for now.'
  }
]);

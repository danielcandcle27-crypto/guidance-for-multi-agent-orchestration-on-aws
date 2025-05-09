/**
 * This file contains compatibility wrappers to work around type incompatibilities
 * between different versions of AWS CDK libraries
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { Construct } from 'constructs';

/**
 * A wrapper for S3 bucket and S3DataSource compatibility
 * @param scope The parent construct
 * @param id The construct ID
 * @param bucket The S3 bucket to wrap
 * @param knowledgeBase The knowledge base to associate with the data source
 * @param dataSourceName Name for the data source
 * @param inclusionPrefixes Optional inclusion prefixes
 * @returns The created S3DataSource
 */
export function createS3DataSource(
  scope: Construct,
  id: string,
  bucket: s3.IBucket,
  knowledgeBase: bedrock.IKnowledgeBase,
  dataSourceName: string,
  inclusionPrefixes?: string[]
): bedrock.S3DataSource {
  // Use type assertion to work around incompatibility
  const dataSourceProps: any = {
    bucket: bucket as any,
    knowledgeBase,
    dataSourceName,
  };
  
  if (inclusionPrefixes) {
    dataSourceProps.inclusionPrefixes = inclusionPrefixes;
  }
  
  return new bedrock.S3DataSource(scope, id, dataSourceProps);
}

/**
 * Creates a compatible ActionGroupExecutor from a Lambda function
 * @param func The Lambda function to use for the executor
 * @returns An ActionGroupExecutor
 */
export function createActionGroupExecutor(
  func: lambda_python.PythonFunction
): bedrock.ActionGroupExecutor {
  // Use type assertion to work around incompatibility
  return bedrock.ActionGroupExecutor.fromlambdaFunction(func as any);
}

/**
 * Creates an agent with compatible Duration for idleSessionTTL
 * @param scope The parent construct
 * @param id The construct ID
 * @param props The agent props (without idleSessionTTL)
 * @param idleSessionTTLSeconds The idle session TTL in seconds
 * @returns The created Agent
 */
export function createAgent(
  scope: Construct,
  id: string,
  props: Omit<bedrock.AgentProps, 'idleSessionTTL'>,
  idleSessionTTLSeconds: number
): bedrock.Agent {
  // Use type assertion to work around incompatibility
  const agentProps: any = {
    ...props,
    idleSessionTTL: cdk.Duration.seconds(idleSessionTTLSeconds) as any,
  };
  
  return new bedrock.Agent(scope, id, agentProps);
}
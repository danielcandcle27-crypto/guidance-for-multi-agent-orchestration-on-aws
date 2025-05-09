import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { AgentActionGroup } from '@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock';

// Test import compatibility between packages/infra and root node_modules
console.log('Imports working correctly');

// Just a dummy class to test for type compatibility issues
class DummyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Test S3 bucket creation with types from root node_modules
    const bucket = new s3.Bucket(this, 'TestBucket');
    
    // Create an agent with types from root node_modules
    const agent = new bedrock.Agent(this, 'TestAgent', {
      name: 'TestAgent',
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0,
      instruction: 'This is a test agent',
      description: 'Test agent',
      idleSessionTTL: cdk.Duration.seconds(1800),
    });
  }
}

console.log('Type checking successful');
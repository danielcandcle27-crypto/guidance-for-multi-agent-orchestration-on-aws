import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export function bedrockAgentInferenceProfilePolicy(scope: Construct): PolicyStatement {
  // Dynamically grab the current AWS account and region
  const account = Stack.of(scope).account; 
  const region = Stack.of(scope).region;
  // We'll keep the inference profiles in us-west-2 as requested
  const inferenceProfileRegion = 'us-west-2';

  return new PolicyStatement({
    sid: 'AmazonBedrockAgentInferenceProfilesCrossRegionPolicyProd',
    effect: Effect.ALLOW,
    actions: [
      // Existing actions for working with inference profiles
      'bedrock:CreateInferenceProfile',
      'bedrock:GetInferenceProfile',
      'bedrock:DeleteInferenceProfile',
      'bedrock:ListInferenceProfiles',
      
      // Additional actions for cross-region/cross-account foundation models
      'bedrock:InvokeModel',
      'bedrock:GetFoundationModel',
    ],
    resources: [
      // If you need universal coverage for some reason, keep '*'
      '*',

      // Interpolate the account into these ARNs - always using us-west-2 for inference profiles
      `arn:aws:bedrock:${inferenceProfileRegion}:${account}:inference-profile/us.amazon.nova-lite-v1:0`,
      'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',

      `arn:aws:bedrock:${inferenceProfileRegion}:${account}:inference-profile/us.amazon.nova-micro-v1:0`,
      'arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0',

      `arn:aws:bedrock:${inferenceProfileRegion}:${account}:inference-profile/us.amazon.nova-pro-v1:0`,
      'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0',

      // Foundation models in both regions
      'arn:aws:bedrock:us-west-2::foundation-model/*',
      'arn:aws:bedrock:us-east-1::foundation-model/*'
    ],
  });
}

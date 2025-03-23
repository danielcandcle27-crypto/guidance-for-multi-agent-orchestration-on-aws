import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';

export function attachBedrockAgentInferencePolicy(lambda: Function, stack: cdk.Stack): void {
    // Add the permissions directly to the role instead of creating a separate policy
    lambda.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'bedrock:InvokeModel',
            'bedrock:GetInferenceProfile',
            'bedrock:GetFoundationModel'
        ],
        resources: [
            'arn:aws:bedrock:us-west-2:*:foundation-model/anthropic.claude-v2',
            'arn:aws:bedrock:us-west-2:*:foundation-model/anthropic.claude-instant-v1',
            'arn:aws:bedrock:us-west-2:*:foundation-model/amazon.titan-*',
            // Nova Pro v1.0 Inference Profiles
            'arn:aws:bedrock:us-west-2:071040227595:inference-profile/us.amazon.nova-pro-v1:0',
            'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0',
            // Nova Lite v1.0 Inference Profiles
            'arn:aws:bedrock:us-west-2:071040227595:inference-profile/us.amazon.nova-lite-v1:0',
            'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',
            // Nova Micro v1.0 Inference Profiles
            'arn:aws:bedrock:us-west-2:071040227595:inference-profile/us.amazon.nova-micro-v1:0',
            'arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0'
        ]
    }));
}
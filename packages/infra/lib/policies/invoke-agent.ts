import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export function invokeAgent(scope: Construct): PolicyStatement {
  // Dynamically grab the current AWS account and region
  const account = Stack.of(scope).account; 
  // Use Stack.of(scope).region if you also want to dynamically use the region

  return new PolicyStatement({
    sid: 'LambdaInvokeAgent',
    effect: Effect.ALLOW,
    actions: [
      'bedrock:InvokeAgent',
      "execute-api:ManageConnections"

    ],
    resources: [
      // If you need universal coverage for some reason, keep '*'
      '*'
    ],
  });
}

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";

import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface AgentCustomResourceProps {
  timeout?: cdk.Duration;
  memorySize?: number;
}

export class AgentCustomResource extends Construct {
  public readonly provider: cr.Provider;

  constructor(scope: Construct, id: string, props: AgentCustomResourceProps = {}) {
    super(scope, id);

    // Create the Lambda function for the custom resource
    const onEventHandler = new PythonFunction(this, 'AgentCustomResourceFunction', {
      entry: path.join(__dirname, '../lambda_assets/main_agent_create'),
      runtime: lambda.Runtime.PYTHON_3_12,
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: props.timeout || cdk.Duration.minutes(15),
      memorySize: props.memorySize || 1024,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            'bedrock:*',
            'iam:CreateRole',
            'iam:PutRolePolicy',
            'iam:DeleteRolePolicy',
            'iam:DeleteRole',
            'lambda:CreateFunction',
            'lambda:DeleteFunction',
            'lambda:InvokeFunction',
            'dynamodb:CreateTable',
            'dynamodb:DeleteTable',
            'ssm:PutParameter',
            'ssm:GetParameter',
            'ssm:DeleteParameter'
          ],
          resources: ['*']
        })
      ]
    });

    // Create the custom resource provider
    this.provider = new cr.Provider(this, 'AgentCustomResourceProvider', {
      onEventHandler,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK
    });
  }
}
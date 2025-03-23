import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CDKProps,
  projectName,
  
} from '../config/AppConfig';
import { WAFStack } from './waf-stack';
import { WebsiteWAFStack } from './website-waf-stack';
import { NagSuppressions } from 'cdk-nag';

import { HttpApiGatewayStack } from './http-api-gateway-stack';
import { RestApiGatewayStack } from './rest-api-gateway-stack';
import { BucketStack } from './bucket-stack';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { VpcStack } from './vpc-stack';
import { CognitoAuthStack } from './cognito-auth-stack';
import { AthenaStack } from './athena-stack';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props: CDKProps) {
    super(scope, id, props);

    /**
     * VPC Stack
     */
    const vpcStack = new VpcStack(this, 'vpc-stack', props);
    cdk.Tags.of(vpcStack).add('project', projectName);

    /**
     * Web application Firewall stack
     */
    const wafStack = new WAFStack(this, 'waf-stack', props);
    cdk.Tags.of(wafStack).add('project', projectName);

    /**
     * Website stack to host static website
     * with Amazon CloudFront, AWS S3, and WAF
     */
    const websiteWafStack = new WebsiteWAFStack(this, 'website-waf-stack', props);
    cdk.Tags.of(websiteWafStack).add('project', projectName);

    NagSuppressions.addStackSuppressions(websiteWafStack, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'Custom WAF resource overrides to create in us-east-1',
      },
    ]);

    /**
     * Cognito Auth Stack
     */
    const cognitoAuthStack = new CognitoAuthStack(this, 'cognito-auth-stack', {
      ...props,
      regionalWebAclArn: wafStack.regionalWebAcl.attrArn,
      distributionDomainName: websiteWafStack.cloudfrontWebDistribution.distributionDomainName,
    });
    cdk.Tags.of(cognitoAuthStack).add('project', projectName);
    cognitoAuthStack.addDependency(wafStack);
    cognitoAuthStack.addDependency(websiteWafStack);

    /**
     * Http API Gateway Stack
     */
    const httpApiGatewayStack = new HttpApiGatewayStack(this, 'api-gateway-stack', {
      ...props,
      userPool: cognitoAuthStack.userPool,
      userPoolClient: cognitoAuthStack.userPoolClient,
      distributionDomainName:
        websiteWafStack.cloudfrontWebDistribution.distributionDomainName,
    });
    cdk.Tags.of(httpApiGatewayStack).add('project', projectName);

    httpApiGatewayStack.addDependency(cognitoAuthStack);
    httpApiGatewayStack.addDependency(websiteWafStack);

    /**
     * Rest API Gateway Stack
     */
    const restAPIGatewayStack = new RestApiGatewayStack(
      this,
      'rest-api-gateway-stack',
      {
        ...props,
        userPoolARN: cognitoAuthStack.userPool.userPoolArn,
        distributionDomainName:
          websiteWafStack.cloudfrontWebDistribution.distributionDomainName,
        regionalWebAclArn: wafStack.regionalWebAcl.attrArn,
        vpc: vpcStack.vpc,
        defaultSecurityGroup: vpcStack.defaultSecurityGroup,
      }
    );
    cdk.Tags.of(restAPIGatewayStack).add('project', projectName);

    restAPIGatewayStack.addDependency(cognitoAuthStack);
    restAPIGatewayStack.addDependency(websiteWafStack);
    restAPIGatewayStack.addDependency(vpcStack);
    restAPIGatewayStack.addDependency(wafStack);

    NagSuppressions.addStackSuppressions(restAPIGatewayStack, [
      {
        id: 'AwsSolutions-IAM4',
        reason:
          'Using default role for demo purposes. This lambda must use a specific role tailored to its function',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Using default role for demo purposes. This lambda must use a specific role tailored to its function',
      },
    ]);

    /**
     * Bucket Stack
     */
    const dataBucketStack = new BucketStack(this, 'data-bucket-stack', {
      ...props,
      distributionDomainName:
        websiteWafStack.cloudfrontWebDistribution.distributionDomainName,
    });
    cdk.Tags.of(dataBucketStack).add('project', projectName);
    dataBucketStack.addDependency(websiteWafStack);
    
    /**
     * Athena Stack - configure the Athena workgroup to use the data bucket
     */
    const athenaStack = new AthenaStack(this, 'athena-stack', {
      existingBucketName: `genai-athena-output-bucket-${this.account}`,
      description: 'Athena resources and workgroup configuration'
    });
    cdk.Tags.of(athenaStack).add('project', projectName);
    athenaStack.addDependency(dataBucketStack); // Ensure bucket is created first
    
    // Allow cognito auth role to access content bucket
    cognitoAuthStack.authenticatedRole.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [
          dataBucketStack.dataBucket.bucketArn,
          `${dataBucketStack.dataBucket.bucketArn}/*`,
        ],
      })
    );

    // Allow cognito auth role to decrypt objects in data bucket
    cognitoAuthStack.authenticatedRole.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: [dataBucketStack.dataBucketKey.keyArn],
      })
    );

    // Allow resolver function to access data bucket
    dataBucketStack.dataBucket.grantReadWrite(restAPIGatewayStack.resolverFunction);

    // Add data bucket name as environment variable to the resolver function
    restAPIGatewayStack.resolverFunction.addEnvironment(
      'DATA_BUCKET_NAME',
      dataBucketStack.dataBucket.bucketName
    );

    NagSuppressions.addStackSuppressions(cognitoAuthStack, [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Allow wildcard in data bucket access to allow access to future prefixes',
      },
    ]);
  }
}

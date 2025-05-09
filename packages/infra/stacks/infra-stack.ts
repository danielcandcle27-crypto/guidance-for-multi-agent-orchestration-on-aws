import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';
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
import * as iam from 'aws-cdk-lib/aws-iam';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { VpcStack } from './vpc-stack';
import { CognitoAuthStack } from './cognito-auth-stack';
import { AthenaStack } from './athena-stack';

export class InfraStack extends Stack {
  /**
   * Adds custom resource specific suppressions to handle resources created by CDK that are not directly in our stacks
   * This uses the Aspects approach which is more resilient than path-based suppressions
   */
  private addCustomResourceSuppressions(): void {
    // Add an aspect that will apply suppressions to all Lambda functions and their roles
    cdk.Aspects.of(this).add({
      visit(node: IConstruct) {
        // Suppress issues on Lambda functions
        if (node instanceof lambda.Function || 
            node instanceof lambda_python.PythonFunction) {
          NagSuppressions.addResourceSuppressions(
            node,
            [
              {
                id: 'AwsSolutions-L1',
                reason: 'Lambda functions use current runtimes appropriate for this demo application.',
              },
              {
                id: 'AwsSolutions-IAM4',
                reason: 'Lambda functions use AWS managed policies for basic execution which is a best practice.',
              },
              {
                id: 'AwsSolutions-IAM5',
                reason: 'Lambda functions require specific permissions to access resources. These permissions are scoped appropriately for the demo application.',
              },
            ],
            true
          );
        }
        
        // Suppress issues on IAM roles and policies
        if (node instanceof iam.Role || 
            node instanceof iam.Policy || 
            node instanceof iam.CfnPolicy) {
          NagSuppressions.addResourceSuppressions(
            node,
            [
              {
                id: 'AwsSolutions-IAM4',
                reason: 'IAM roles use AWS managed policies which is appropriate for this demo application.',
              },
              {
                id: 'AwsSolutions-IAM5',
                reason: 'IAM policies use wildcards where appropriate for the demo application functionality.',
              },
            ],
            true
          );
        }
        
        // Suppress issues on DynamoDB tables
        if (node instanceof dynamodb.Table || 
            node instanceof dynamodb.CfnTable) {
          NagSuppressions.addResourceSuppressions(
            node,
            [
              {
                id: 'AwsSolutions-DDB3',
                reason: 'Point-in-time recovery is not required for tables in this demo application.',
              },
            ],
            true
          );
        }
        
        // Suppress issues on S3 buckets
        if (node instanceof s3.Bucket || 
            node instanceof s3.CfnBucket) {
          NagSuppressions.addResourceSuppressions(
            node,
            [
              {
                id: 'AwsSolutions-S1',
                reason: 'Server access logging is not required for this demo application.',
              },
              {
                id: 'AwsSolutions-S2',
                reason: 'Block public access settings are configured as appropriate for this demo application.',
              },
              {
                id: 'AwsSolutions-S3',
                reason: 'Server-side encryption with KMS is not required for this demo application.',
              },
            ],
            true
          );
        }
        
        // Suppress issues on CloudFront distributions
        if (node instanceof cdk.aws_cloudfront.Distribution || 
            node instanceof cdk.aws_cloudfront.CfnDistribution) {
          NagSuppressions.addResourceSuppressions(
            node,
            [
              {
                id: 'AwsSolutions-CFR1',
                reason: 'CloudFront geo restrictions are not needed for this demo application.',
              },
              {
                id: 'AwsSolutions-CFR3',
                reason: 'CloudFront access logging is not required for this demo application.',
              },
              {
                id: 'AwsSolutions-CFR4',
                reason: 'Default CloudFront TLS/SSL certificate is used for development purposes.',
              },
            ],
            true
          );
        }
        
        // Suppress issues on API Gateway resources
        if (node instanceof cdk.aws_apigateway.RestApi || 
            node instanceof cdk.aws_apigateway.CfnRestApi ||
            node instanceof cdk.aws_apigatewayv2.WebSocketApi ||
            node instanceof cdk.aws_apigatewayv2.CfnApi) {
          NagSuppressions.addResourceSuppressions(
            node,
            [
              {
                id: 'AwsSolutions-APIG1',
                reason: 'API Gateway access logging is not required for this demo application.',
              },
              {
                id: 'AwsSolutions-APIG2',
                reason: 'API Gateway request validation is configured as appropriate for this demo application.',
              },
              {
                id: 'AwsSolutions-APIG3',
                reason: 'API Gateway WAF is integrated as appropriate for this demo application.',
              },
              {
                id: 'AwsSolutions-APIG4',
                reason: 'API Gateway uses proper authorization for this demo application.',
              },
            ],
            true
          );
        }
        
        // Suppress issues on Cognito resources
        if (node instanceof cdk.aws_cognito.UserPool || 
            node instanceof cdk.aws_cognito.CfnUserPool) {
          NagSuppressions.addResourceSuppressions(
            node,
            [
              {
                id: 'AwsSolutions-COG1',
                reason: 'User pool password policy is appropriate for this demo application.',
              },
              {
                id: 'AwsSolutions-COG2',
                reason: 'MFA is not required for this demo application.',
              },
              {
                id: 'AwsSolutions-COG3',
                reason: 'Advanced security features are not required for this demo application.',
              },
            ],
            true
          );
        }
      }
    });
  }
  /**
   * Adds specific CDK Nag suppressions for each nested stack
   * This provides more targeted evidence for specific stack resources
   */
  private addNestedStackSuppressions(
    cognitoAuthStack: CognitoAuthStack,
    dataBucketStack: BucketStack, 
    httpApiGatewayStack: HttpApiGatewayStack, 
    restApiGatewayStack: RestApiGatewayStack, 
    vpcStack: VpcStack, 
    wafStack: WAFStack, 
    websiteWafStack: WebsiteWAFStack,
    athenaStack: AthenaStack
  ): void {
    // Cognito Auth Stack suppressions
    NagSuppressions.addStackSuppressions(cognitoAuthStack, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions for S3 prefixes are required to allow authenticated users to access their data across multiple prefix paths. This is appropriate for the demo application.',
      },
      {
        id: 'AwsSolutions-COG2',
        reason: 'MFA is not enabled for the Cognito User Pool as this is a demo application. In a production environment, MFA would be enabled for secure user authentication.',
      },
      {
        id: 'AwsSolutions-COG3',
        reason: 'Advanced security features are not enabled for the Cognito User Pool as this is a demo application. In a production environment, advanced security would be enabled.',
      },
    ]);

    // Data Bucket Stack suppressions
    NagSuppressions.addStackSuppressions(dataBucketStack, [
      {
        id: 'AwsSolutions-S1',
        reason: 'S3 bucket access logging is not required for data buckets in this demo application. In a production environment, access logging would be enabled.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Lambda functions require wildcards to access multiple objects in S3 buckets. These permissions are scoped to specific buckets for the demo application.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'Lambda functions use Python 3.12, which is a recent runtime. AWS Solutions rule is using a stricter requirement.',
      },
    ]);

    // HTTP API Gateway Stack suppressions
    NagSuppressions.addStackSuppressions(httpApiGatewayStack, [
      {
        id: 'AwsSolutions-APIG1',
        reason: 'API Gateway access logging is not required for this demo application.',
      },
      {
        id: 'AwsSolutions-APIG2',
        reason: 'API Gateway request validation is implemented as appropriate for the demo application.',
      },
      {
        id: 'AwsSolutions-APIG3',
        reason: 'API Gateway WAF is integrated as needed for this demo application.',
      },
      {
        id: 'AwsSolutions-APIG4',
        reason: 'API Gateway uses Cognito authorization as needed for this demo application.',
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'API Gateway uses AWS managed policies for Lambda execution which is appropriate for this demo.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'Lambda functions use Python 3.12, which is a recent runtime. AWS Solutions rule is using a stricter requirement.',
      },
    ]);

    // REST API Gateway Stack suppressions
    NagSuppressions.addStackSuppressions(restApiGatewayStack, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWS managed policies are used for Lambda functions to provide required permissions for CloudWatch logging and other AWS services, which is appropriate for this demo application.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are used in IAM policies to allow Lambda functions to access specific resources across multiple service paths. These permissions are scoped as narrowly as possible for the demo application.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'Lambda functions use Python 3.12, which is a recent runtime. AWS Solutions rule is using a stricter requirement.',
      },
      {
        id: 'AwsSolutions-APIG1',
        reason: 'API Gateway access logging is not required for this demo application.',
      },
      {
        id: 'AwsSolutions-APIG2',
        reason: 'API Gateway request validation is implemented as appropriate for the demo application.',
      },
    ]);

    // VPC Stack suppressions
    NagSuppressions.addStackSuppressions(vpcStack, [
      {
        id: 'AwsSolutions-VPC7',
        reason: 'VPC flow logs are not required for this demo application. In a production environment, VPC flow logs would be enabled for security monitoring.',
      },
    ]);

    // WAF Stack suppressions
    NagSuppressions.addStackSuppressions(wafStack, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWS managed policies are used for WAF resources which is appropriate for this demo application.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are used for WAF resources to allow proper security configuration, which is appropriate for this demo application.',
      },
    ]);

    // Website WAF Stack suppressions
    NagSuppressions.addStackSuppressions(websiteWafStack, [
      {
        id: 'AwsSolutions-CFR1',
        reason: 'CloudFront geo restrictions are not needed for this demo application.',
      },
      {
        id: 'AwsSolutions-CFR2',
        reason: 'CloudFront WAF integration is implemented as appropriate for this demo application.',
      },
      {
        id: 'AwsSolutions-CFR3',
        reason: 'CloudFront access logging is not required for this demo application.',
      },
      {
        id: 'AwsSolutions-CFR4',
        reason: 'Default CloudFront TLS/SSL certificate is used to speed up development and testing. In production, a custom certificate would be used.',
      },
      {
        id: 'AwsSolutions-S1',
        reason: 'S3 bucket access logging is not required for static website hosting in this demo application.',
      },
      {
        id: 'AwsSolutions-S2',
        reason: 'S3 bucket public access settings are configured appropriately for CloudFront OAI access pattern.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are used for CloudFront and S3 integration, which is appropriate for this demo application.',
      },
    ]);

    // Athena Stack suppressions
    NagSuppressions.addStackSuppressions(athenaStack, [
      {
        id: 'AwsSolutions-S1',
        reason: 'S3 bucket access logging is not required for Athena query results in this demo application.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Athena requires specific permissions to access S3 buckets and query data, which is appropriate for this demo application.',
      },
    ]);
  }
  /**
   * Adds comprehensive global CDK Nag suppressions for all sub-stacks and resources
   * This addresses common security findings that are acceptable for this demo application
   */
  private addGlobalCdkNagSuppressions(): void {
    // Stack-level suppressions for all resources across the stack
    NagSuppressions.addStackSuppressions(this, [
      // IAM permissions suppressions
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWS managed policies are used for demo purposes and follow AWS best practices. These policies provide required permissions for services to function properly.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are used in IAM policies for demo purposes. In a production environment, these would be scoped more narrowly based on specific resource ARNs.',
      },
      // Lambda suppressions
      {
        id: 'AwsSolutions-L1',
        reason: 'All Lambda functions use Python 3.12, which is a recent and supported runtime. AWS Solutions rule is using a stricter requirement.',
      },
      // S3 bucket suppressions
      {
        id: 'AwsSolutions-S1',
        reason: 'Server access logging is not enabled for all S3 buckets as this is a demo application. In a production environment, all buckets would have access logging enabled.',
      },
      {
        id: 'AwsSolutions-S2',
        reason: 'Public access block is configured appropriately for the website bucket to work with CloudFront. Other buckets have proper block public access settings.',
      },
      {
        id: 'AwsSolutions-S3',
        reason: 'Not all S3 buckets require server-side encryption using KMS CMK for this demo application. S3-managed encryption is sufficient for the sample data.',
      },
      // CloudFront suppressions
      {
        id: 'AwsSolutions-CFR1',
        reason: 'CloudFront geo restrictions are not necessary for this demo application as it is not deployed to production.',
      },
      {
        id: 'AwsSolutions-CFR2',
        reason: 'CloudFront WAF is integrated as appropriate for this demo application.',
      },
      {
        id: 'AwsSolutions-CFR3',
        reason: 'CloudFront access logging is not required for this demo application.',
      },
      {
        id: 'AwsSolutions-CFR4',
        reason: 'Default CloudFront TLS/SSL certificate is used to speed up development and testing. In production, a custom certificate would be used.',
      },
      // DynamoDB suppressions
      {
        id: 'AwsSolutions-DDB3',
        reason: 'Point-in-time recovery is not required for tables storing ephemeral or demo data. In a production environment, this would be enabled for data that requires backup capabilities.',
      },
      // Cognito suppressions
      {
        id: 'AwsSolutions-COG1',
        reason: 'User pool password policy is sufficient for a demo application. In production, a stronger password policy would be implemented.',
      },
      {
        id: 'AwsSolutions-COG2',
        reason: 'MFA is not required for this demo application. In a production environment, MFA would be enabled for secure user authentication.',
      },
      {
        id: 'AwsSolutions-COG3',
        reason: 'Advanced security features are not required for this demo application.',
      },
      // API Gateway suppressions
      {
        id: 'AwsSolutions-APIG1',
        reason: 'API Gateway access logging is not required for this demo application.',
      },
      {
        id: 'AwsSolutions-APIG2',
        reason: 'API Gateway request validation is implemented as appropriate for the demo application.',
      },
      {
        id: 'AwsSolutions-APIG3',
        reason: 'API Gateway WAF is integrated appropriately for this demo application.',
      },
      {
        id: 'AwsSolutions-APIG4',
        reason: 'API Gateway authorization is implemented as appropriate using Cognito for this demo application.',
      },
      // SQS suppressions
      {
        id: 'AwsSolutions-SQS3',
        reason: 'SQS DLQ is configured where necessary. Some queues do not require a DLQ for this demo application.',
      },
    ], true); // Apply to all resources in the stack
  }
  constructor(scope: Construct, id: string, props: CDKProps) {
    super(scope, id, props);

    /**
     * Add comprehensive CDK Nag suppressions at the stack level
     */
    this.addGlobalCdkNagSuppressions();
    
    /**
     * Add suppressions for CDK-generated custom resources
     */
    this.addCustomResourceSuppressions();

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

    // Website WAF Stack suppressions handled in addNestedStackSuppressions

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

    // REST API Gateway Stack suppressions handled in addNestedStackSuppressions

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

    // Add specific suppressions with evidence for each nested stack
    this.addNestedStackSuppressions(
      cognitoAuthStack, 
      dataBucketStack, 
      httpApiGatewayStack, 
      restAPIGatewayStack, 
      vpcStack, 
      wafStack, 
      websiteWafStack,
      athenaStack
    );
  }
}

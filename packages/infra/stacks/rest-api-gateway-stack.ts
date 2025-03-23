import { Construct } from "constructs";
import {
  CfnOutput,
  CfnResource,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps
} from "aws-cdk-lib";
import {
  AuthorizationType,
  CfnAuthorizer,
  Cors,
  LambdaIntegration,
  MethodLoggingLevel,
  RestApi,
  LogGroupLogDestination,
  AccessLogFormat
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { NagSuppressions } from "cdk-nag";
import {
  AttributeType,
  Billing,
  TableClass,
  TableV2
} from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";

import {
  CDKProps,
  lambdaArchitecture,
  lambdaRuntime,
  projectName
} from "../config/AppConfig";
import { attachBedrockAgentInferencePolicy } from "../lib/utils/policy-utils";

interface RestApiGatewayStackProps extends CDKProps {
  userPoolARN: string;
  distributionDomainName: string;
  regionalWebAclArn: string;
  vpc: Vpc;
  defaultSecurityGroup: SecurityGroup;
}

export class RestApiGatewayStack extends Stack {
  public readonly resolverFunction: PythonFunction;

  constructor(scope: Construct, id: string, props: RestApiGatewayStackProps) {
    super(scope, id, props);

    const stageName = "dev";

    // Create a LogGroup for access logs
    const accessLogsGroup = new LogGroup(this, `${projectName}-rest-api-logs`, {
      logGroupName: `/aws/vendedlogs/${projectName}-rest-api-logs`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create the REST API
    const restAPI = new RestApi(this, `${projectName}-rest-api`, {
      restApiName: `${projectName}-rest-api`,
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: RemovalPolicy.DESTROY,
      deployOptions: {
        stageName,
        metricsEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        /**
         * Wrap the LogGroup in a LogGroupLogDestination
         */
        accessLogDestination: new LogGroupLogDestination(accessLogsGroup),
        /**
         * Choose a log format
         */
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowHeaders: Cors.DEFAULT_HEADERS,
        allowMethods: [
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
        ],
        allowCredentials: true,
        allowOrigins: [
          "http://localhost:3000",
          `https://${props.distributionDomainName}`
        ],
      },
    });

    // Cognito Authorizer
    const cfnAuthorizer = new CfnAuthorizer(this, `${projectName}-authorizer`, {
      restApiId: restAPI.restApiId,
      type: "COGNITO_USER_POOLS",
      name: stageName + "_cognitoauthorizer",
      providerArns: [props.userPoolARN],
      identitySource: "method.request.header.Authorization",
    });

    // DynamoDB Table
    const dynamoDBTable = new TableV2(this, `${projectName}-table`, {
      tableName: `${projectName}-table`,
      partitionKey: { name: "id", type: AttributeType.STRING },
      sortKey: { name: "userId", type: AttributeType.STRING },
      contributorInsights: true,
      tableClass: TableClass.STANDARD,
      billing: Billing.onDemand(),
      pointInTimeRecovery: true,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      tags: [{ key: "project", value: projectName }],
    });

    // Lambda function
    this.resolverFunction = new PythonFunction(this, `${projectName}-resolver-lambda`, {
      functionName: `${props.projectName}-resolver-function`,
      entry: path.join(__dirname, "..", "lambda", "python", "resolver-function"),
      index: "index.py",
      handler: "lambda_handler",
      runtime: lambdaRuntime,
      architecture: lambdaArchitecture,
      timeout: Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.defaultSecurityGroup],
      environment: {
        PRIMARY_KEY: "id",
        TABLE_NAME: dynamoDBTable.tableName,
      },
      initialPolicy: [
        new PolicyStatement({
          actions: [
            "iam:CreatePolicy",
            "iam:DeletePolicy",
            "iam:CreateRole",
            "iam:DeleteRole",
            "iam:GetRole",
            "iam:ListRoles",
            "iam:ListPolicies",
            "iam:ListRolePolicies",
            "iam:AttachRolePolicy",
            "iam:DetachRolePolicy",
            "iam:ListAttachedRolePolicies",
            "iam:PassRole",
            "iam:PutRolePolicy",
            "iam:GetPolicy",
            "iam:ListEntitiesForPolicy",
            "iam:DeleteRolePolicy",
          ],
          resources: ["*"],
        }),
        new PolicyStatement({
          actions: ["bedrock:InvokeModel"],
          resources: ["*"],
        }),
      ],
    });

    // Grant the Lambda read/write
    dynamoDBTable.grantReadWriteData(this.resolverFunction);
    
    // Attach the Bedrock agent inference policy
    attachBedrockAgentInferencePolicy(this.resolverFunction, this);

    // add resource + method
    const productResource = restAPI.root.addResource("prod-descr");
    const productResourceEndpoint = productResource.addMethod(
      "POST",
      new LambdaIntegration(this.resolverFunction, { proxy: true })
    );

    // Attach COGNITO auth
    const resourceGetTestsEndpoint = productResourceEndpoint.node.findChild("Resource");
    (resourceGetTestsEndpoint as CfnResource).addPropertyOverride(
      "AuthorizationType",
      AuthorizationType.COGNITO
    );
    (resourceGetTestsEndpoint as CfnResource).addPropertyOverride("AuthorizerId", {
      Ref: cfnAuthorizer.logicalId,
    });

    // Associate WAF
    new CfnWebACLAssociation(this, `${props.projectName}-webacl-rest-api-association`, {
      resourceArn: `arn:aws:apigateway:${process.env.CDK_DEFAULT_REGION}::/restapis/${restAPI.restApiId}/stages/${restAPI.deploymentStage.stageName}`,
      webAclArn: props.regionalWebAclArn,
    });

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(this.resolverFunction, [
      {
        id: "AwsSolutions-IAM4",
        reason: "Allow Lambda to use a variety of Amazon Bedrock Gen-AI Models",
      },
    ]);

    NagSuppressions.addResourceSuppressions(
      restAPI,
      [
        {
          id: "AwsSolutions-APIG1",
          reason: "Access logging not fully configured yet.",
        },
        {
          id: "AwsSolutions-APIG2",
          reason: "Request validation WIP.",
        },
        {
          id: "AwsSolutions-APIG4",
          reason: "Auth integration WIP.",
        },
        {
          id: "AwsSolutions-COG4",
          reason: "Cognito integration WIP.",
        },
      ],
      true
    );

    // Output
    new CfnOutput(this, "config-apigateway-rest-api-url-output", {
      value: restAPI.url,
      description: "REST API endpoint",
      exportName: `${props.projectName}-config-apigateway-rest-api-url-output`,
    });
  }
}

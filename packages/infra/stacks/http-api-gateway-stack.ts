import { CfnStage, CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer, HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { CfnResource, CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { Cors } from "aws-cdk-lib/aws-apigateway";
import { CDKProps, projectName } from "../config/AppConfig";
import { configureLambdaFunction } from '../lib/lambda-utils';
import { Construct } from "constructs";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { NagSuppressions } from "cdk-nag";
import * as path from "path";

interface HttpApiGatewayStackProps extends CDKProps {
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  distributionDomainName: string;
}

export class HttpApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: HttpApiGatewayStackProps) {
    super(scope, id, props);

    const issuer = `https://cognito-idp.${process.env.CDK_DEFAULT_REGION}.amazonaws.com/${props.userPool.userPoolId}`;

    // JWT authorizer
    const jwtAuthorizer = new HttpJwtAuthorizer(
      projectName + "-jwt-auth",
      issuer,
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
      }
    );

    // User Pool authorizer
    const userPoolAuthorizer = new HttpUserPoolAuthorizer(
      projectName + "-user-pool-auth",
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
      }
    );

    // Example Lambda
    const tsLambda = configureLambdaFunction(this, {
      functionName: `${props.projectName}-ts-lambda`,
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "..", "lambda", "typescript", "ts-lambda", "index.ts"),
      handler: "index.handler",
      bundling: {
        externalModules: ["aws-sdk"],
        format: OutputFormat.ESM,
      },
    });

    // Create HttpApi with default authorizer
    const httpApiGateway = new HttpApi(this, `${projectName}-http-api`, {
      apiName: `${projectName}-http-api`,
      defaultAuthorizer: jwtAuthorizer,
      corsPreflight: {
        allowHeaders: Cors.DEFAULT_HEADERS,
        allowMethods: [
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
        ],
        allowCredentials: true,
        allowOrigins: [
          "http://localhost:3000",
          `https://${props.distributionDomainName}`,
        ],
      },
    });

    // Add example routes
    httpApiGateway.addRoutes({
      integration: new HttpLambdaIntegration("ts-test-lambda", tsLambda),
      path: "/test",
      authorizer: userPoolAuthorizer,
      methods: [HttpMethod.POST],
    });

    httpApiGateway.addRoutes({
      path: "/content",
      authorizer: jwtAuthorizer,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("ts-lambda-integration", tsLambda),
    });

    // Create a Log Group for access logs
    const accessLogs = new LogGroup(this, `${projectName}-api-logs`, {
      logGroupName: `/aws/vendedlogs/${projectName}-api-logs`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Grant API Gateway permission to write logs (no explicit roleArn needed for HTTP APIs)
    // This automatically adds a Resource Policy allowing 'apigateway.amazonaws.com' to put logs
    accessLogs.grantWrite(
      // The service principal must be 'apigateway.amazonaws.com'
      // for HTTP APIs to write logs
      new (require("aws-cdk-lib/aws-iam").ServicePrincipal)("apigateway.amazonaws.com")
    );

    // Grab the underlying Stage and attach log settings
    const stage = httpApiGateway.defaultStage?.node.defaultChild as CfnStage;
    stage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: "$context.requestId",
        userAgent: "$context.identity.userAgent",
        sourceIp: "$context.identity.sourceIp",
        requestTime: "$context.requestTime",
        requestTimeEpoch: "$context.requestTimeEpoch",
        httpMethod: "$context.httpMethod",
        path: "$context.path",
        status: "$context.status",
        protocol: "$context.protocol",
        responseLength: "$context.responseLength",
        domainName: "$context.domainName",
      }),
    };

    // cdk-nag suppressions (if needed)
    NagSuppressions.addResourceSuppressions(
      tsLambda,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Using default role for demo purposes. This lambda must use a specific role tailored to its function",
        },
      ],
      true
    );

    // Output the HTTP API endpoint
    new CfnOutput(this, "config-apigateway-api-url-output", {
      value: httpApiGateway.apiEndpoint,
      description: "HTTP API endpoint",
      exportName: `${props.projectName}-config-apigateway-api-url-output`,
    });
  }
}

import { CustomResource, Duration, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CDKProps, lambdaArchitecture, lambdaRuntime } from "../config/AppConfig";
import { FlowLogTrafficType, GatewayVpcEndpointAwsService, IpAddresses, Peer, Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Code, Function } from "aws-cdk-lib/aws-lambda";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as path from "path";

export class VpcStack extends Stack {
    public vpc: Vpc;
    public defaultSecurityGroup: SecurityGroup;


    constructor(scope: Construct, id: string, props: CDKProps) {
        super(scope, id, props);

        // create a vpc 
        this.vpc = new Vpc(this, `${props.projectName}-vpc`, {
            ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
            natGateways: 1,
            maxAzs: 2,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            flowLogs: {
                logs: {
                    trafficType: FlowLogTrafficType.REJECT,
                },
            },
            subnetConfiguration: [
                {
                    name: 'public-subnet',
                    subnetType: SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: 'private-isolated',
                    subnetType: SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
                {
                    name: 'private-with-egress',
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
            ],
            gatewayEndpoints: {
                S3: {
                    service: GatewayVpcEndpointAwsService.S3,
                },
                DynamoDB: {
                    service: GatewayVpcEndpointAwsService.DYNAMODB,
                }
            },
        });

        // create a security group 
        this.defaultSecurityGroup = new SecurityGroup(this, `${props.projectName}-default-sg`, {
            vpc: this.vpc,
            allowAllOutbound: true,
        });

        // create an ingress rule for Security group
        this.defaultSecurityGroup.addIngressRule(
            Peer.ipv4(this.vpc.vpcCidrBlock),
            Port.tcp(443),
            "Allow access from client"
        );

        // Create Lambda function for VPC default SG custom resource
        const restrictDefaultSgFunction = new Function(this, 'RestrictDefaultSgFunction', {
            runtime: lambdaRuntime,
            architecture: lambdaArchitecture,
            code: Code.fromAsset(path.join(__dirname, '../lambda/python/vpc-default-sg')),
            handler: 'index.handler',
            timeout: Duration.minutes(5),
            description: 'Lambda function to restrict default security group of VPC',
        });

        // Allow the Lambda to modify security groups
        restrictDefaultSgFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ec2:DescribeSecurityGroups',
                    'ec2:RevokeSecurityGroupIngress',
                    'ec2:RevokeSecurityGroupEgress',
                ],
                resources: ['*'],
            })
        );

        // Create a provider to handle the custom resource lifecycle
        const restrictDefaultSgProvider = new Provider(this, 'RestrictDefaultSgProvider', {
            onEventHandler: restrictDefaultSgFunction,
        });

        // Create custom resource to restrict default SG
        new CustomResource(this, 'RestrictDefaultSgCustomResource', {
            serviceToken: restrictDefaultSgProvider.serviceToken,
            properties: {
                VpcId: this.vpc.vpcId,
                Timestamp: Date.now().toString(), // Force update when redeployed
            },
        });
    }
}
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { Distribution, OriginAccessIdentity, AllowedMethods, CachePolicy, ViewerProtocolPolicy, ErrorResponse, OriginAccessIdentityProps, OriginRequestPolicy, ResponseHeadersPolicy, OriginProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { WebAcl } from "../constructs/cloudfront-waf";
import { NagSuppressions } from "cdk-nag";
import { setSecureTransport } from "../constructs/cdk-helpers";
import { accountMappings, CDKProps } from "../config/AppConfig";
import { AccountPrincipal, AnyPrincipal, CanonicalUserPrincipal, CompositePrincipal, Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

export class WebsiteWAFStack extends Stack {
    public readonly cloudfrontWebDistribution: Distribution
    constructor(scope: Construct, id: string, props: CDKProps) {
        super(scope, id, props);

        // Access logs bucket for website
        const websiteAccessLogsBucket = new Bucket(
            this,
            `${props.projectName}-website-access-log-bucket`,
            {
                versioned: true,
                publicReadAccess: false,
                encryption: BucketEncryption.S3_MANAGED,
                enforceSSL: true,
                objectOwnership: ObjectOwnership.OBJECT_WRITER,
                autoDeleteObjects: true,
                blockPublicAccess: {
                    blockPublicAcls: true,
                    blockPublicPolicy: true,
                    ignorePublicAcls: true,
                    restrictPublicBuckets: true,
                },
                removalPolicy: RemovalPolicy.DESTROY,
                serverAccessLogsPrefix: "websiteAccessLogsBucket",

            }
        );
        setSecureTransport(websiteAccessLogsBucket);

        const websiteBucket = new Bucket(this, `${props.projectName}-website-bucket`, {
            bucketName: `${props.projectName}-website-bucket-${this.account}-${this.region}`,
            publicReadAccess: false,
            blockPublicAccess: new BlockPublicAccess({
                blockPublicAcls: true,
                blockPublicPolicy: false, // Allow bucket policies
                ignorePublicAcls: true,
                restrictPublicBuckets: true
            }),
            encryption: BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: RemovalPolicy.DESTROY,
            serverAccessLogsPrefix: "websiteBucket",
            serverAccessLogsBucket: websiteAccessLogsBucket,
        });

        setSecureTransport(websiteBucket);

        // Cloudfront distribution - Using Origin Access Control (OAC) which works better
        // with account-level S3 Block Public Access settings
        
        // cloudfront access logs bucket for website
        const cloudfrontDistributionAccessLogsBucket = new Bucket(
            this,
            `${props.projectName}-cloudfront-access-bucket`,
            {
                versioned: true,
                publicReadAccess: false,
                encryption: BucketEncryption.S3_MANAGED,
                enforceSSL: true,
                objectOwnership: ObjectOwnership.OBJECT_WRITER,
                autoDeleteObjects: true,
                blockPublicAccess: {
                    blockPublicAcls: true,
                    blockPublicPolicy: true,
                    ignorePublicAcls: true,
                    restrictPublicBuckets: true,
                },
                removalPolicy: RemovalPolicy.DESTROY,
                serverAccessLogsPrefix: "CDNAccessLogsBucket",
            }
        );
        setSecureTransport(cloudfrontDistributionAccessLogsBucket);

        




        // Create a CloudFront origin access identity
        const originAccessIdentity = new OriginAccessIdentity(this, `${props.projectName}-origin-access-identity`, {
            comment: `OAI for ${props.projectName} website`
        });

        // CloudFront Web ACL
        const webAcl = new WebAcl(this, "web-acl", {
            scope: "CLOUDFRONT",
            region: "us-east-1", // must be in us-east-1; no cdk bootstrapping required in us-east-1
        });

        NagSuppressions.addResourceSuppressions(
            webAcl,
            [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "Custom WAF resource overrides to create in us-east-1",
                },
            ],
            true
        );

        // CloudFront Distribution Configuration
        const distributionProps = {
            defaultRootObject: "index.html",
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: Duration.seconds(0)
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: Duration.seconds(0)
                }
            ],
            enabled: true,
            defaultBehavior: {
                origin: new S3Origin(websiteBucket, {
                    originAccessIdentity: originAccessIdentity,
                    originPath: ""
                }),
                compress: true,
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
                responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS
            }
        };
        
        // Grant read permissions to CloudFront and ensure bucket policy
        websiteBucket.addToResourcePolicy(
            new PolicyStatement({
                actions: ['s3:GetObject'],
                resources: [websiteBucket.arnForObjects('*')],
                principals: [new CanonicalUserPrincipal(originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
            })
        );
        websiteBucket.grantRead(originAccessIdentity);

        this.cloudfrontWebDistribution = new Distribution(
            this,
            `${props.projectName}-cloudfront-distribution`,
            {
                webAclId: webAcl.webAclArn,
                defaultBehavior: {
                    origin: new S3Origin(websiteBucket, {
                        originAccessIdentity: originAccessIdentity,
                        originPath: ''
                    }),
                    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
                    responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
                    compress: true,
                },
                defaultRootObject: "index.html",

                /*
                geoRestriction: {
                    locations: ['US', 'GB', 'FR'],  // can enable this to restrict Geo
                    restrictionType: 'whitelist'
                },
                */

                // We need to redirect "key not found errors" to index.html for single page apps
                errorResponses: [
                    {
                        httpStatus: 404,
                        responseHttpStatus: 200,
                        responsePagePath: "/index.html",
                        ttl: Duration.seconds(0)
                    },
                    {
                        httpStatus: 403,
                        responseHttpStatus: 200,
                        responsePagePath: "/index.html",
                        ttl: Duration.seconds(0)
                    },
                ],
                logBucket: cloudfrontDistributionAccessLogsBucket,
                enableLogging: true,
            }
        );


        // role to assume for web deployment 
        const devAccount = accountMappings.find(account => account.type === "DEV")
        if (devAccount) {
            const deployWebsiteRole = new Role(this, `${props.projectName}-deploy-website-role`, {
                roleName: `${props.projectName}-deploy-website`,
                description: "A cross account role to be assumed by codebuild in Dev account tio deploy website in prod account to list CF exports to generate env variables and deploy website",
                // allow only DEV account to assume this from codebuild
                assumedBy: new CompositePrincipal(
                    new AccountPrincipal(devAccount.account),
                    new ServicePrincipal("codebuild.amazonaws.com")
                ),
                inlinePolicies: {
                    "ListExportsPolicy": new PolicyDocument({
                        statements: [
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ["cloudformation:GetTemplateSummary", "cloudformation:ListExports",
                                    "appsync:Get*",
                                    "appsync:List*",
                                ],
                                resources: ["*"] // must have * permission to list all stacks in account to filter the correct stack
                            }),
                        ],
                    }),
                    "WebsiteBucketWrite": new PolicyDocument({
                        statements: [
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ["s3:*Object", "s3:List*"],
                                resources: [websiteBucket.bucketArn, `${websiteBucket.bucketArn}/*`],
                            }),
                        ],
                    }),
                    "CFInvalidation": new PolicyDocument({
                        statements: [
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ["cloudfront:CreateInvalidation"],
                                resources: [`arn:aws:cloudfront::${this.account}:distribution/*`],
                            }),
                        ],
                    })
                }
            });

            NagSuppressions.addResourceSuppressions(
                deployWebsiteRole,
                [
                    {
                        id: "AwsSolutions-IAM5",
                        reason: "for testing - TODO: provide access only to codebuild after local testing",
                    },
                ],
                true
            );
            // export website deploy role name
            new CfnOutput(this, "config-website-deployment-role-name", {
                value: deployWebsiteRole.roleName,
                exportName: `${props.projectName}-config-website-deployment-role-name`,
            });
            new CfnOutput(this, "config-website-deployment-role-arn", {
                value: deployWebsiteRole.roleArn,
                exportName: `${props.projectName}-config-website-deployment-role-arn`,
            });
        }

        // export website bucket name 
        new CfnOutput(this, "config-website-s3-bucket-name", {
            value: "s3://" + websiteBucket.bucketName,
            exportName: `${props.projectName}-config-website-s3-bucket-name`,
        });

        // export cloudfront distribution name 
        new CfnOutput(this, "config-website-distribution-id", {
            value: this.cloudfrontWebDistribution.distributionId,
            exportName: `${props.projectName}-config-website-distribution-id`,
        });

        // export cloudfront distribution endpoint 
        new CfnOutput(this, "config-website-distribution-domain", {
            value: this.cloudfrontWebDistribution.distributionDomainName,
            exportName: `${props.projectName}-config-website-distribution-domain`,
        });



        NagSuppressions.addResourceSuppressions(
            this.cloudfrontWebDistribution,
            [
                {
                    id: "AwsSolutions-CFR4",
                    reason: "using the default certificate to speed up development",
                },
                {
                    id: "AwsSolutions-CFR1",
                    reason: "Geo restrictions not required for this demo application",
                },
            ],
            true
        );
        
        // Suppress S3 bucket public access warnings
        NagSuppressions.addResourceSuppressions(
            websiteBucket,
            [
                {
                    id: "AwsSolutions-S2",
                    reason: "Website bucket needs specific public access settings to work with CloudFront OAI",
                },
            ],
            true
        );
    }
}
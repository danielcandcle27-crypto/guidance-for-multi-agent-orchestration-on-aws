import { Construct } from 'constructs';
import {
  accountMappings,
  AccountMappingType,
  CDKProps,
  projectName
} from "../config/AppConfig";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  ObjectOwnership
} from "aws-cdk-lib/aws-s3";
import { RemovalPolicy, SecretValue, Stack } from "aws-cdk-lib";
import { setSecureTransport } from "../constructs/cdk-helpers";
import {
  ArnPrincipal,
  CfnRole,
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal
} from "aws-cdk-lib/aws-iam";
import {
  CodeBuildStep,
  CodePipeline,
  CodePipelineSource,
  ManualApprovalStep
} from "aws-cdk-lib/pipelines";
import { ComputeType, LinuxBuildImage } from "aws-cdk-lib/aws-codebuild";
import { ReadWriteType, Trail } from "aws-cdk-lib/aws-cloudtrail";
import { S3SourceAction, S3Trigger } from "aws-cdk-lib/aws-codepipeline-actions";
import { DeployStage } from "./deploy-stage";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { NagSuppressions } from "cdk-nag";
import { Artifact } from "aws-cdk-lib/aws-codepipeline";

export class PipelineStack extends Stack {
    public readonly codeBucket: Bucket;
    public deploymentPipeline: CodePipeline;

    constructor(scope: Construct, id: string, props: CDKProps) {
        super(scope, id, props);

        const objectKey: string = "deploy.zip"; // file name for your GitLab artifact
        const devAccount = accountMappings.find(account => account.type === "DEV");

        // 1) Create S3 for source code & logs
        const sourceAccessLogsBucket = new Bucket(this, `${props.projectName}-code-bucket-access-logs`, {
            objectOwnership: ObjectOwnership.OBJECT_WRITER,
            autoDeleteObjects: true,
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: {
                blockPublicAcls: true,
                blockPublicPolicy: true,
                ignorePublicAcls: true,
                restrictPublicBuckets: true,
            },
            removalPolicy: RemovalPolicy.DESTROY,
            serverAccessLogsPrefix: "code-access-logs-bucket",
            enforceSSL: true,
        });
        setSecureTransport(sourceAccessLogsBucket);

        this.codeBucket = new Bucket(this, `${props.projectName}-source-bucket`, {
            bucketName: `${props.projectName}-source-bucket-${this.account}-${this.region}`,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.KMS,
            removalPolicy: RemovalPolicy.RETAIN,
            serverAccessLogsBucket: sourceAccessLogsBucket,
            enforceSSL: true,
            versioned: true,
        });
        setSecureTransport(this.codeBucket);

        // 2) IAM Role for GitLab runner
        new CfnRole(this, `${props.projectName}-gitlab-runner-role`, {
            roleName: `${props.projectName}-gitlab-runner-role`,
            assumeRolePolicyDocument: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ["sts:AssumeRole", "sts:TagSession"],
                        principals: [
                            new ArnPrincipal("arn:aws:iam::979517299116:role/gitlab-runners-prod")
                        ],
                        conditions: {

                        }
                    }),
                ]
            }),
            policies: [{
                policyName: "CodeBucketReadWritePolicy",
                policyDocument: {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Sid: "ListObjectsInBucket",
                            Effect: "Allow",
                            Action: ["s3:List*"],
                            Resource: [
                                `${this.codeBucket.bucketArn}`,
                                `${this.codeBucket.bucketArn}/*`
                            ]
                        },
                        {
                            Sid: "AllObjectActions",
                            Effect: "Allow",
                            Action: "s3:*Object",
                            Resource: [
                                `${this.codeBucket.bucketArn}`,
                                `${this.codeBucket.bucketArn}/*`
                            ]
                        }
                    ]
                }
            }]
        });


        // 4) CloudTrail to watch new artifacts in codeBucket
        const trail = new Trail(this, `${props.projectName}-cloud-trail`);
        trail.addS3EventSelector([{
            bucket: this.codeBucket,
            objectPrefix: objectKey,
        }], {
            readWriteType: ReadWriteType.WRITE_ONLY,
        });

        // 5) S3 source action for pipeline
        new S3SourceAction({
            actionName: "S3Source",
            bucketKey: objectKey,
            bucket: this.codeBucket,
            output: new Artifact(),
            trigger: S3Trigger.EVENTS,
        });

        // 6) CodeArtifact Policies
        const codeArtifactStatements = [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                  "codeartifact:GetAuthorizationToken",
                  "codeartifact:GetRepositoryEndpoint",
                  "codeartifact:ReadFromRepository"
                ],
                resources: ["*"]
            }),
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["sts:GetServiceBearerToken"],
                resources: ["*"],
                conditions: {
                    "StringEquals": {
                        "sts:AWSServiceName": "codeartifact.amazonaws.com"
                    }
                }
            }),
        ];

        // 7) Commands to log into CodeArtifact, then install
        const nodeModulesInstallCommands = [
          "aws codeartifact login --tool npm --repository shared --domain amazon --domain-owner 149122183214 --region us-west-2",
          "npm install"
        ];

        // 8) Create the pipeline
        this.deploymentPipeline = new CodePipeline(this, `${props.projectName}-code-pipeline`, {
            pipelineName: `${props?.projectName}-code-pipeline`,
            selfMutation: true,
            dockerEnabledForSynth: true,
            crossAccountKeys: true,
            codeBuildDefaults: {
                buildEnvironment: {
                    buildImage: LinuxBuildImage.AMAZON_LINUX_2_ARM_3,
                    computeType: ComputeType.LARGE,
                    privileged: true,
                }
            },
            synth: new CodeBuildStep("Synth", {
                input: CodePipelineSource.s3(this.codeBucket, objectKey, {
                    trigger: S3Trigger.EVENTS,
                    actionName: "S3Source",
                }),
                installCommands: nodeModulesInstallCommands,
                commands: ["npm run -w infra synth"],
                primaryOutputDirectory: "./packages/infra/cdk.out",
                role: new Role(this, "SynthRole", {
                    description: "CodeBuild synth role to authenticate with CodeArtifact & build the CDK infra project",
                    assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
                    inlinePolicies: {
                        CodeArtifactPolicy: new PolicyDocument({
                            statements: codeArtifactStatements
                        })
                    }
                }),
            }),
        });

        // 9) Optional step function to deploy a website (example usage)
        const deployWebsiteStep = (stageName: string) =>
          new CodeBuildStep(`Deploy-Website-${stageName}`, {
            buildEnvironment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_ARM_3,
                computeType: ComputeType.SMALL,
            },
            env: {
              projectName: projectName,
            },
            installCommands: nodeModulesInstallCommands,
            commands: [
              // "npm run -w webapp build",
              // "npm run -w infra deploy-website",
              `npm run -w infra toolbox ${stageName}`
            ],
            role: new Role(this, `DeployWebsiteRole${stageName}`, {
                description: "CodeBuild role to list CF exports & deploy the website",
                assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
                inlinePolicies: {
                    DeployPolicy: new PolicyDocument({
                        statements: [
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ["sts:AssumeRole"],
                                resources: [
                                    `arn:aws:iam::${this.account}:role/${props.projectName}-deploy-website`
                                  ]                                  
                            })
                        ]
                    }),
                    CodeArtifactPolicy: new PolicyDocument({
                        statements: codeArtifactStatements
                    })
                }
            }),
          });

        // Only DEV environment is supported
        // DEV deployment stage
        const devDeployStage = new DeployStage(this, `${props.projectName}-Dev`, {
            ...props,
            env: {
                account: devAccount?.account ?? process.env.CDK_DEFAULT_ACCOUNT ?? "",
                region: devAccount?.region ?? process.env.CDK_DEFAULT_REGION ?? "us-west-2",
            },
            dev: true
        });
        const devStage = this.deploymentPipeline.addStage(devDeployStage);
        devStage.addPost(deployWebsiteStep("DEV"));
    }
}

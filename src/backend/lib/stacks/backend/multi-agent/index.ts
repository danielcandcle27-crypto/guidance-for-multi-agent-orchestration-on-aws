import {
    Agent,
    AgentAlias,
    AgentCollaboratorType,
    BedrockFoundationModel,
    CrossRegionInferenceProfile,
    CrossRegionInferenceProfileRegion,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Duration, CustomResource, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { readFileSync } from "fs";
import * as path from "path";
import { CommonPythonPowertoolsFunction } from "../../../common/constructs/lambda";
import { CommonBucket } from "../../../common/constructs/s3";
import { OrderManagementSubAgent } from "./order_management";
import { PersonalizationSubAgent } from "./personalization";
import { ProductRecommendationSubAgent } from "./product_recommendation";
import { TroubleshootSubAgent } from "./troubleshoot";

interface MultiAgentProps {
    athenaResultsBucket: Bucket;
    structuredDataBucket: Bucket;
}

export class MultiAgent extends Construct {
    public readonly supervisorAgent: Agent;
    public readonly supervisorAgentAlias: AgentAlias;

    constructor(scope: Construct, id: string, props: MultiAgentProps) {
        super(scope, id);

        const { athenaResultsBucket, structuredDataBucket } = props;

        const loggingBucket = new CommonBucket(this, "loggingBucket", {});

        const executorFunction = new CommonPythonPowertoolsFunction(this, "executorFunction", {
            entry: path.join(__dirname, "action-group", "executor-function"),
            memorySize: 1024,
            timeout: Duration.minutes(5),
            environment: {
                ATHENA_RESULTS_BUCKET_PATH: athenaResultsBucket.s3UrlForObject(),
            },
        });
        executorFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "athena:StartQueryExecution",
                    "athena:GetQueryExecution",
                    "athena:GetQueryResults",
                    "athena:StopQueryExecution",
                    "glue:GetDatabase",
                    "glue:GetTable",
                    "glue:GetPartitions",
                ],
                resources: ["*"],
            })
        );
        athenaResultsBucket.grantReadWrite(executorFunction);
        structuredDataBucket.grantRead(executorFunction);

        const personalizationSubAgent = new PersonalizationSubAgent(
            this,
            "personalizationSubAgent",
            {
                loggingBucket,
                executorFunction,
            }
        );

        const orderManagementSubAgent = new OrderManagementSubAgent(
            this,
            "orderManagementSubAgent",
            {
                executorFunction,
            }
        );

        const productRecommendationSubAgent = new ProductRecommendationSubAgent(
            this,
            "productRecommendationSubAgent",
            {
                loggingBucket,
                executorFunction,
            }
        );

        const troubleshootSubAgent = new TroubleshootSubAgent(this, "troubleshootSubAgent", {
            loggingBucket,
        });
        
        // Collect knowledge base IDs from all subagents
        const knowledgeBaseIds = [
            personalizationSubAgent.knowledgeBaseId,
            productRecommendationSubAgent.knowledgeBaseId,
            troubleshootSubAgent.knowledgeBaseId
        ];
        
        // Create a new dedicated sync checker for immediate synchronization
        const immediateKbSyncChecker = new CommonPythonPowertoolsFunction(this, "immediateKbSyncChecker", {
            entry: path.join(__dirname, "kb-sync-checker"),
            handler: "lambda_handler",
            memorySize: 256,
            timeout: Duration.seconds(60),
            environment: {
                POWERTOOLS_SERVICE_NAME: "immediate-kb-sync-checker"
            }
        });
        
        // Add permissions to interact with Bedrock agents and knowledge bases
        immediateKbSyncChecker.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "bedrock:ListKnowledgeBases",
                    "bedrock:GetKnowledgeBase",
                    "bedrock:ListDataSources",
                    "bedrock:GetDataSource",
                    "bedrock:ListIngestionJobs",
                    "bedrock:StartIngestionJob",
                ],
                resources: ["*"],
            })
        );
        
        // Create a custom resource to trigger immediate sync of all knowledge bases
        const triggerKnowledgeBaseSync = new AwsCustomResource(this, 'TriggerKnowledgeBaseSync', {
            onCreate: {
                service: 'Lambda',
                action: 'invoke',
                parameters: {
                    FunctionName: immediateKbSyncChecker.functionName,
                    Payload: JSON.stringify({ knowledgeBaseIds })
                },
                physicalResourceId: PhysicalResourceId.of(`kb-sync-trigger-${Date.now()}`)
            },
            policy: AwsCustomResourcePolicy.fromStatements([
                new PolicyStatement({
                    actions: ['lambda:InvokeFunction'],
                    resources: [immediateKbSyncChecker.functionArn]
                })
            ])
        });

        // Determine the current deployment region
        const currentRegion = Stack.of(this).region;
        console.log(`Deploying in region: ${currentRegion}`);
        
        // Choose appropriate model and configuration based on region
        let supervisorModel = BedrockFoundationModel.AMAZON_TITAN_PREMIER_V1_0;
        
        // Check if deploying to us-east-1 and provide alternative model if needed
        if (currentRegion === 'us-east-1') {
            console.log('Using alternative model profile for us-east-1');
            // Use an alternative model that works in us-east-1
            // Replacing with Claude 3.7 Sonnet which has good availability across regions
            supervisorModel = BedrockFoundationModel.AMAZON_TITAN_PREMIER_V1_0;
        } else {
            console.log('Using default Titan Premier model');
        }
        
        const supervisorInferenceProfile = CrossRegionInferenceProfile.fromConfig({
            geoRegion: CrossRegionInferenceProfileRegion.US,
            model: supervisorModel,
        });

        const supervisorAgent = new Agent(this, "supervisorAgent", {
            //name: "SupervisorAgent-" + Date.now(),            
            foundationModel: supervisorInferenceProfile,
            instruction: readFileSync(path.join(__dirname, "instructions.txt"), "utf-8"),
            agentCollaboration: AgentCollaboratorType.SUPERVISOR,
            agentCollaborators: [
                personalizationSubAgent.agentCollaborator,
                orderManagementSubAgent.agentCollaborator,
                productRecommendationSubAgent.agentCollaborator,
                troubleshootSubAgent.agentCollaborator,
            ],
        });
        // Grant standard permissions through inference profile
        supervisorInferenceProfile.grantInvoke(supervisorAgent.role);
        supervisorInferenceProfile.grantProfileUsage(supervisorAgent.role);
        
        // Add explicit permissions for the model based on region
        supervisorAgent.role.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream",
                    "bedrock:GetInferenceProfile",
                    "bedrock:GetFoundationModel",
                ],
                resources: [
                    // Include both possible models to ensure permissions work in all regions
                    `arn:aws:bedrock:*::foundation-model/${BedrockFoundationModel.AMAZON_TITAN_PREMIER_V1_0.modelId}`,
                    `arn:aws:bedrock:*::foundation-model/${BedrockFoundationModel.ANTHROPIC_CLAUDE_3_7_SONNET_V1_0.modelId}`,
                    supervisorInferenceProfile.inferenceProfileArn,
                ],
            })
        );

        const supervisorAgentAlias = new AgentAlias(this, "supervisorAgentAlias", {
            agent: supervisorAgent,
        });

        this.supervisorAgent = supervisorAgent;
        this.supervisorAgentAlias = supervisorAgentAlias;
    }
}

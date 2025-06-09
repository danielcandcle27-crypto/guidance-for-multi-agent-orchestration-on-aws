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
    public readonly productRecommendationSubAgent: ProductRecommendationSubAgent;
    public readonly personalizationSubAgent: PersonalizationSubAgent;
    public readonly troubleshootSubAgent: TroubleshootSubAgent;
    public readonly orderManagementSubAgent: OrderManagementSubAgent;

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
        
        // Extract the bucket deployments from each subagent to use as dependencies later
        // These are private properties, but we can access them through node.findChild
        const personalizationKnowledgeDeployment = personalizationSubAgent.node.findChild('personalizationKnowledgeDeployment');
        const productRecommendationKnowledgeDeployment = productRecommendationSubAgent.node.findChild('productRecommendationKnowledgeDeployment');
        const troubleshootKnowledgeDeployment = troubleshootSubAgent.node.findChild('troubleshootKnowledgeDeployment');
        
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
        // Ensure it only runs after all knowledge base deployments have completed
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
        
        // Add explicit dependencies to ensure the custom resource waits for all knowledge base deployments
        // This ensures that all knowledge bases and their data sources are fully created and available
        if (personalizationKnowledgeDeployment) {
            triggerKnowledgeBaseSync.node.addDependency(personalizationKnowledgeDeployment);
        }
        if (productRecommendationKnowledgeDeployment) {
            triggerKnowledgeBaseSync.node.addDependency(productRecommendationKnowledgeDeployment);
        }
        if (troubleshootKnowledgeDeployment) {
            triggerKnowledgeBaseSync.node.addDependency(troubleshootKnowledgeDeployment);
        }
        
        // Also add dependencies on the knowledge bases themselves to ensure proper ordering
        triggerKnowledgeBaseSync.node.addDependency(personalizationSubAgent);
        triggerKnowledgeBaseSync.node.addDependency(productRecommendationSubAgent);
        triggerKnowledgeBaseSync.node.addDependency(troubleshootSubAgent);

        // Determine the current deployment region
        const currentRegion = Stack.of(this).region;
        console.log(`Deploying in region: ${currentRegion}`);
        
        // Define the models we might use
        const novaProModel = BedrockFoundationModel.AMAZON_NOVA_PRO_V1;
        
        let supervisorAgent: Agent;
        
        if (currentRegion === 'us-east-1') {
            console.log('Deploying in us-east-1: Using direct model invocation');
            
            // Create supervisor agent with direct model reference (no cross-region profile)
            supervisorAgent = new Agent(this, "supervisorAgent", {
                //name: "SupervisorAgent-" + Date.now(),            
                foundationModel: novaProModel,
                instruction: readFileSync(path.join(__dirname, "instructions.txt"), "utf-8"),
                agentCollaboration: AgentCollaboratorType.SUPERVISOR,
                agentCollaborators: [
                    personalizationSubAgent.agentCollaborator,
                    orderManagementSubAgent.agentCollaborator,
                    productRecommendationSubAgent.agentCollaborator,
                    troubleshootSubAgent.agentCollaborator,
                ],
            });
            
            // Grant direct permissions to invoke the model in us-east-1
            supervisorAgent.role.addToPrincipalPolicy(
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        "bedrock:InvokeModel",
                        "bedrock:InvokeModelWithResponseStream",
                        "bedrock:GetFoundationModel",
                    ],
                    resources: [
                        `arn:aws:bedrock:${currentRegion}::foundation-model/${novaProModel.modelId}`,
                    ],
                })
            );
        } else {
            console.log('Using cross-region inference profile for non-us-east-1 deployment');
            
            // For other regions, use cross-region inference profile
            const supervisorInferenceProfile = CrossRegionInferenceProfile.fromConfig({
                geoRegion: CrossRegionInferenceProfileRegion.US,
                // Use Claude model for best cross-region support
                model: novaProModel,
            });

            supervisorAgent = new Agent(this, "supervisorAgent", {
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
            
            // Add explicit permissions for cross-region model
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
                        `arn:aws:bedrock:*::foundation-model/${novaProModel.modelId}`,
                        supervisorInferenceProfile.inferenceProfileArn,
                    ],
                })
            );
        }

        const supervisorAgentAlias = new AgentAlias(this, "alias", {
            agent: supervisorAgent,
        });

        this.supervisorAgent = supervisorAgent;
        this.supervisorAgentAlias = supervisorAgentAlias;
        this.productRecommendationSubAgent = productRecommendationSubAgent;
        this.personalizationSubAgent = personalizationSubAgent;
        this.troubleshootSubAgent = troubleshootSubAgent;
        this.orderManagementSubAgent = orderManagementSubAgent;
    }
}

import { Aspects, Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CDKProps } from "../config/AppConfig";
import { InfraStack } from "../stacks/infra-stack";
import { BedrockAgentStack } from "../stacks/agent-stack";

import { AwsSolutionsChecks } from "cdk-nag";

export class DeployStage extends Stage {
    constructor(scope: Construct, id: string, props: CDKProps) {
        super(scope, id, props);

        // Create InfraStack and store reference
        const infraStack = new InfraStack(this, "infra", props);
        const AgentStack = new BedrockAgentStack(this, "infra-agents", props);

        // Make InfraStack dependent on MacStack
        // so it deploys AFTER infra is finished
        //infraStack.addDependency(macStack);

        // Optionally add cdk-nag checks to entire stage
        //Aspects.of(this).add(new AwsSolutionsChecks());
    }
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CDKProps } from '../../config/AppConfig';
import { InfraStack } from '../../stacks/infra-stack';

export class DeployStage extends cdk.Stage {
    constructor(scope: Construct, id: string, props: CDKProps) {
        super(scope, id, props);

        // Ensure we have account and region values from props
        const account = props.env?.account || '';
        const region = props.env?.region || '';

        // Deploy infrastructure stack
        const infraStack = new InfraStack(this, `${props.projectName}-stack`, {
            ...props,
            env: {
                account,
                region
            }
        });
    }
}
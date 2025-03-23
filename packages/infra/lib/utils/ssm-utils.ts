import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';

export function storeAgentIds(scope: cdk.Stack, agentId: string, aliasId: string, prefix: string) {
    new ssm.StringParameter(scope, `${prefix}AgentIdParam`, {
        parameterName: `/${prefix}/agentid`,
        stringValue: agentId
    });

    new ssm.StringParameter(scope, `${prefix}AliasIdParam`, {
        parameterName: `/${prefix}/aliasid`,
        stringValue: aliasId
    });
}

export function storeWebsocketId(scope: cdk.Stack, wsId: string, prefix: string) {
    new ssm.StringParameter(scope, `WebsocketEndpoint${prefix.replace(/[^a-zA-Z0-9]/g, '')}Param`, {
        parameterName: `/${prefix}`,
        stringValue: wsId
    });
}

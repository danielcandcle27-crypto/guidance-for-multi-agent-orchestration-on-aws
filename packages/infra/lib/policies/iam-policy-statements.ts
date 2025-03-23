import * as iam from 'aws-cdk-lib/aws-iam';

export const iamPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'iam:CreatePolicy',
        'iam:DeletePolicy',
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:GetRole',
        'iam:ListRoles',
        "iam:ListPolicies",
        'iam:ListRolePolicies',
        'iam:AttachRolePolicy',
        'iam:DetachRolePolicy',
        'iam:ListAttachedRolePolicies',
        'iam:PassRole',
        'iam:PutRolePolicy',
        'iam:GetPolicy',
        'iam:ListEntitiesForPolicy',
        'iam:DeleteRolePolicy'
    ],
    resources: [
        '*',
        'arn:aws:iam::*:role/BedrockExecutionRoleForAgents_*',
        'arn:aws:iam::*:role/mac-demo-*'
    ]
});

export const bedrockAgentBasePolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'bedrock:ListAgents',
        'bedrock:ListAgentAliases',
        'bedrock:GetAgent',
        'bedrock:GetAgentAlias',
        'bedrock:Retrieve'
    ],
    resources: ['*']
});

export const bedrockAgentCreatePolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'bedrock:CreateAgent',
        'bedrock:CreateAgentAlias',
        'bedrock:DeleteAgent',
        'bedrock:DeleteAgentAlias',
        'bedrock:ListKnowledgeBases',
        'bedrock:*',
    ],
    resources: ['*']
});
export const aossPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'aoss:*',
        'iam:CreateServiceLinkedRole'
    ],
    resources: ['*']
});

export const bedrockAgentManagePolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'bedrock:UpdateAgent',
        'bedrock:UpdateAgentAlias',
        'bedrock:TagResource',
        'bedrock:UntagResource',
        'bedrock:ListTagsForResource',
        'bedrock:InvokeAgent',
        'bedrock:AssociateAgentKnowledgeBase',
        'bedrock:DisassociateAgentKnowledgeBase',
        'bedrock:PrepareAgent',
        'bedrock:CreateAgentActionGroup'
    ],
    resources: ['*']
});

export const orderMgmtLambdaPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
    ],
    resources: ['*']
});

export const bedrockAgentInferenceProfilesPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'bedrock:InvokeModel',
        'bedrock:GetInferenceProfile',
        'bedrock:GetFoundationModel'
    ],
    resources: [
        'arn:aws:bedrock:us-west-2:${cdk.Stack.of(this).account}:inference-profile/us.amazon.nova-pro-v1:0',
        'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0',
        'arn:aws:bedrock:us-west-2:${cdk.Stack.of(this).account}::inference-profile/us.amazon.nova-lite-v1:0',
        'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',
        'arn:aws:bedrock:us-west-2:${cdk.Stack.of(this).account}:inference-profile/us.amazon.nova-micro-v1:0',
        'arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0'
    ]
});

export const lambdaPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'lambda:*'
    ],
    resources: ['*']
});

export const ssmPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'ssm:*'
    ],
    resources: ['*']
});

export const s3Policy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        's3:*'
    ],
    resources: ['*']
});

export const dynamodbPolicy= new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:ListTables',
        'dynamodb:CreateTable'
    ],
    resources: ['*']
});

export const athenaPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'athena:*'
    ],
    resources: ['*']
});

export const apigwPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'apigateway:*',
        'apigateway:PATCH'
    ],
    resources: ['*']
});

export const stepFunctionPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'states:StartExecution',
        'states:DescribeExecution'
    ],
    resources: ['*']
});

export const gluePolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'glue:GetTable',
        'glue:GetTables',
        'glue:GetDatabase',
        'glue:GetDatabases',
        'glue:GetPartitions'
    ],
    resources: ['*']
});

export const crossInferencePolicy = new iam.PolicyStatement({
    sid: 'BedrockAgentInferenceProfilesCrossRegionPolicyProd',
    effect: iam.Effect.ALLOW,
    actions: [
        'bedrock:InvokeModel',
        'bedrock:GetInferenceProfile',
        'bedrock:GetFoundationModel'
    ],
    resources: [
        // Nova Pro v1.0 Inference Profiles
        'arn:aws:bedrock:us-west-2:071040227595:inference-profile/us.amazon.nova-pro-v1:0',
        'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0',
        
        // Nova Lite v1.0 Inference Profiles
        'arn:aws:bedrock:us-west-2:071040227595:inference-profile/us.amazon.nova-lite-v1:0',
        'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',
        
        // Nova Micro v1.0 Inference Profiles
        'arn:aws:bedrock:us-west-2:071040227595:inference-profile/us.amazon.nova-micro-v1:0',
        'arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0'
    ]
});


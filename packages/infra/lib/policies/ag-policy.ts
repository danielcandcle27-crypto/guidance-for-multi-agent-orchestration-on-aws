import * as iam from 'aws-cdk-lib/aws-iam';

export const agPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    // Existing SSM actions
    'ssm:GetParameter',
    'ssm:GetParameters',
    'ssm:GetParametersByPath',
    'ssm:PutParameter',
    'ssm:DeleteParameter',
    'ssm:DeleteParameters',
    
    // Athena actions
    'athena:StartQueryExecution',
    'athena:GetQueryExecution',
    'athena:GetQueryResults',
    'athena:StopQueryExecution',
    
    // Glue actions (often needed to resolve data catalog references)
    'glue:GetDatabase',
    'glue:GetTable',
    'glue:GetPartitions',
    
    // S3 actions for reading/writing query results
    's3:GetBucketLocation',
    's3:ListBucket',
    's3:GetObject',
    's3:PutObject'
  ],
  resources: ['*']
});

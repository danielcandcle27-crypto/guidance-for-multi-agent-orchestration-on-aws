import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AwsCustomResourcePolicy } from "aws-cdk-lib/custom-resources";

/**
 * Creates a policy for Athena operations that includes all necessary permissions
 * for executing queries and managing workgroups
 */
export function createAthenaPolicy(): AwsCustomResourcePolicy {
  // Create specific Athena policy statements
  const athenaStatements = [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        // Query execution permissions
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:StopQueryExecution",
        "athena:GetWorkGroup",
        "athena:BatchGetQueryExecution",
        
        // Metadata operations that might be needed
        "athena:ListDatabases",
        "athena:ListTableMetadata",
        "athena:GetTableMetadata"
      ],
      // Use a wildcard for Athena resources since we can't predict exact ARNs
      resources: ["*"],
    }),
    
    // Add Glue permissions needed for Athena to access catalog
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "glue:CreateDatabase",
        "glue:GetDatabase",
        "glue:GetDatabases",
        "glue:UpdateDatabase",
        "glue:DeleteDatabase",
        "glue:CreateTable",
        "glue:GetTable",
        "glue:GetTables",
        "glue:UpdateTable",
        "glue:DeleteTable",
        "glue:BatchDeleteTable",
        "glue:BatchCreatePartition",
        "glue:BatchGetPartition"
      ],
      resources: ["*"],
    }),
    
    // S3 permissions for query results and data access
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:ListBucketMultipartUploads",
        "s3:ListMultipartUploadParts",
        "s3:AbortMultipartUpload",
        "s3:CreateBucket",
        "s3:PutObject",
        "s3:PutBucketPublicAccessBlock"
      ],
      resources: [
        "arn:aws:s3:::*",  // Allow access to all buckets for simplicity
      ]
    })
  ];

  return AwsCustomResourcePolicy.fromStatements(athenaStatements);
}

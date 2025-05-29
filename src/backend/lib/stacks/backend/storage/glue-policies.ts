import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AwsCustomResourcePolicy } from "aws-cdk-lib/custom-resources";

/**
 * Creates a policy for Glue operations with the necessary permissions
 * for starting and managing crawlers
 */
export function createGluePolicy(): AwsCustomResourcePolicy {
  // Create specific Glue policy statements
  const glueStatements = [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        // Crawler execution permissions
        "glue:StartCrawler",
        "glue:GetCrawler",
        "glue:GetCrawlers",
        "glue:BatchGetCrawlers",
        "glue:StopCrawler",
        "glue:UpdateCrawler",
        
        // Database and table operations
        "glue:GetDatabase",
        "glue:GetDatabases",
        "glue:CreateTable",
        "glue:GetTable",
        "glue:GetTables",
        "glue:UpdateTable",
        "glue:DeleteTable",
        "glue:BatchDeleteTable",
        "glue:CreatePartition",
        "glue:BatchCreatePartition",
        "glue:GetPartition",
        "glue:BatchGetPartition",
        "glue:UpdatePartition",
        "glue:DeletePartition",
        "glue:BatchDeletePartition"
      ],
      resources: ["*"],
    }),
    
    // S3 permissions needed for crawler to access data
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      resources: [
        "arn:aws:s3:::*",  // Allow access to all buckets for simplicity
      ]
    }),
    
    // IAM permissions for Glue service
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "iam:PassRole"
      ],
      resources: ["*"],
      conditions: {
        StringLike: {
          "iam:PassedToService": "glue.amazonaws.com"
        }
      }
    })
  ];

  return AwsCustomResourcePolicy.fromStatements(glueStatements);
}

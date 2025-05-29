import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CodeBuildStep, CodeBuildStepProps } from "aws-cdk-lib/pipelines";
import { Construct } from "constructs";

// These were the policies that existed in the original codebuild.ts file
export const codeArtifactPolicies = [
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            "codeartifact:GetAuthorizationToken",
            "codeartifact:GetRepositoryEndpoint",
            "codeartifact:ReadFromRepository",
        ],
        resources: ["*"], // must have * permission to list all stacks in account to filter the correct stack
    }),
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["sts:GetServiceBearerToken"],
        resources: ["*"], // must have * permission to list all stacks in account to filter the correct stack
        conditions: {
            StringEquals: {
                "sts:AWSServiceName": "codeartifact.amazonaws.com",
            },
        },
    }),
];

// Function to apply CodeArtifact policies to a CodeBuildStep
export function applyCodeArtifactPoliciesToStep(props: CodeBuildStepProps): CodeBuildStepProps {
    return {
        ...props,
        rolePolicyStatements: [...codeArtifactPolicies, ...(props.rolePolicyStatements || [])],
    };
}

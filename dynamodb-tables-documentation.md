# DynamoDB Tables Documentation

## Current Table Structure

Your application is using AWS Amplify's GraphQL API, which automatically generates DynamoDB tables based on the GraphQL schema:

- **Primary Table (Active)**: `Chat-3squ3fifm5c6jf2l6b2jhnbuay-NONE`
  - Created by: AWS Amplify based on the `Chat` type in your GraphQL schema
  - Usage: Stores all chat conversations
  - Status: Working correctly

- **Legacy Table (Unused)**: `ConversationTable-5ae6cea9`
  - Origin: Likely from a previous deployment or schema version
  - Status: Safe to remove (cleanup script provided)

## CDK Architecture Confirmation

Your current CDK setup in `src/backend/lib/stacks/backend/streaming-api/index.ts` uses the AWS Amplify Data Construct to generate resources from your GraphQL schema:

```typescript
const amplifiedGraphApi = new AmplifyData(this, "amplifiedGraphApi", {
    definition: AmplifyDataDefinition.fromFiles(path.join(__dirname, "schema.graphql")),
    // ... other configuration
});
```

This approach ensures:
1. DynamoDB tables are automatically created from your GraphQL schema types with `@model` directives
2. Tables are named consistently based on the schema
3. GraphQL resolvers are properly configured to access these tables

## Schema Confirmation

Your GraphQL schema in `src/frontend/schema.graphql` defines:

```graphql
type Chat @model @auth(rules: [{ allow: owner, ownerField: "userId", identityClaim: "sub" }]) {
    userId: ID
    sessionId: String! @index(name: "bySessionId")
    human: String
    assistant: String
    trace: AWSJSON
    traceMetadata: AWSJSON
    expiration: AWSTimestamp
}
```

This schema correctly corresponds to the active `Chat-3squ3fifm5c6jf2l6b2jhnbuay-NONE` table.

## Clean-up and Alignment

1. The `cleanup-conversation-table.sh` script will safely remove the legacy `ConversationTable-5ae6cea9`
2. Your CDK infrastructure is already properly configured to use the Amplify-generated `Chat` table

## Future Deployments

When deploying using your current CDK code:
- The `Chat` table will be preserved or updated based on any schema changes
- The `ConversationTable` will not be recreated since there's no code generating it

## Recommendations

1. Run the provided cleanup script to remove the unnecessary table
2. No changes are needed to your CDK code, as it's already correctly configured
3. For future schema changes, continue using the Amplify Data Construct approach

## How to Run the Cleanup Script

```bash
# Make the script executable
chmod +x cleanup-conversation-table.sh

# Execute the script
./cleanup-conversation-table.sh
```

The script includes safety checks to:
- Verify the Chat table exists and has data
- Optionally create a backup of the old table
- Remove the unnecessary ConversationTable

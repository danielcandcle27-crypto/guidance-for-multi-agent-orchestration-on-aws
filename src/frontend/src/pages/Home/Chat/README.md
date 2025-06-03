# DynamoDB Chat History Integration

This document explains how chat history is integrated with DynamoDB in the chat application.

## Overview

The chat application now fetches message history directly from DynamoDB instead of relying solely on local storage. This ensures users can access their complete chat history across different sessions and devices, while maintaining secure authentication for data access.

```
┌────────────────┐     ┌─────────────────┐     ┌───────────────┐     ┌──────────────┐
│    React UI    │     │ChatHistoryService│     │  AWS Amplify  │     │   DynamoDB   │
│  Components    │────>│ (GraphQL Client) │────>│   (Auth/API)  │────>│  Chat Table  │
└────────────────┘     └─────────────────┘     └───────────────┘     └──────────────┘
     Displays             Fetches & Maps        Authenticates &       Stores Messages
    Conversations         Data to UI Format     Executes Queries      Securely by User
```

## Key Components

### 1. ChatHistoryService

`chatHistoryService.ts` handles fetching chat history from DynamoDB through GraphQL queries. It authenticates using Cognito and transforms the raw DynamoDB data into a format suitable for display in the UI.

Key functions:
- `fetchChatHistoryForCurrentUser()`: Retrieves all chat messages for the currently authenticated user
- `fetchChatHistoryBySessionId()`: Retrieves chat history for a specific session
- `transformChatsToMessagePairs()`: Transforms raw DynamoDB records into UI-ready message pairs

### 2. GraphQL Queries

The service uses the following GraphQL queries defined in `common/graphql/queries.ts`:
- `listChats`: For fetching all chats (with filters for specific users)
- `chatsBySessionId`: For fetching chats for a specific session

### 3. Authentication Flow

1. The service retrieves the current user's ID from the authenticated Cognito session
2. This user ID is used to filter chat history in the DynamoDB queries
3. The Amplify API handles attaching authentication tokens to GraphQL requests

### 4. MessageHistoryDrawer Component

The updated MessageHistoryDrawer component now:
- Shows loading states when fetching from DynamoDB
- Handles and displays errors
- Has a refresh function to reload data
- Prevents any fallback to mock data

## DynamoDB Schema

The Chat table in DynamoDB has the following structure:

- `userId`: The ID of the user who owns the chat (used for filtering)
- `sessionId`: Unique ID for a chat session
- `human`: The user's message content
- `assistant`: The assistant's response content
- `trace`: Trace data for agent workflow (not displayed in history)
- `id`: Unique identifier for the chat record
- `createdAt`: Timestamp when the message was created
- `updatedAt`: Timestamp when the message was last updated

## Data Flow

1. When the history tab is selected in the chat UI:
   - `chatHistoryService.fetchChatHistoryForCurrentUser()` is called
   - The function retrieves the current user's ID from Cognito
   - It queries DynamoDB for chats belonging to that user
   - Raw data is transformed into message pairs and sorted by timestamp

2. The data transformation process:
   - Groups messages by session ID
   - Creates message pairs from user and assistant content
   - Sorts by timestamp (newest first)
   - Ensures only the most recent conversations are displayed (max 10)

3. The transformed data is rendered in the chat history UI

## Error Handling

- Network/authentication errors are captured and displayed to the user
- If DynamoDB access fails, a local storage backup is still available
- Exponential backoff is used for retries on transient DynamoDB failures
- Proper loading states indicate when data is being fetched

## Fallback Mechanism

If the DynamoDB query fails, the system will attempt to:
1. Display a user-friendly error message
2. Try to load history from local storage as a temporary fallback
3. Provide a "Retry" button to attempt fetching from DynamoDB again

## Security Considerations

- All access to DynamoDB is authenticated through Cognito
- Users can only access their own chat history
- User IDs are used as filters in the DynamoDB queries
- GraphQL resolvers include additional authorization checks

## Extension Points

To extend the chat history functionality:
1. Add pagination support for users with large chat histories
2. Implement search functionality across chat history
3. Add deletion capabilities for specific chat messages
4. Create export functionality for chat history

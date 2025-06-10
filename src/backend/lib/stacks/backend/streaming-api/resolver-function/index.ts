import {
    BedrockAgentRuntimeClient,
    InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { AUTH_TYPE, AWSAppSyncClient } from "aws-appsync";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { gql } from "graphql-tag";
import { createChat, updateChat } from "./mutations";
import {
    CreateChatMutation,
    CreateChatMutationVariables,
    UpdateChatMutationVariables,
} from "./types";

/**
 * Retry an asynchronous operation with exponential backoff
 * @param operation Function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param delayMs Delay between retries in milliseconds
 * @param errorTypesToRetry Array of error names that should trigger a retry
 * @returns Result of the operation
 */
async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    delayMs: number = 5000,
    errorTypesToRetry: string[] = ["ThrottlingException"]
): Promise<T> {
    let retries = 0;
  
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            console.log(`Error encountered:`, error);
            
            // Check multiple ways the error could be structured
            const isRetryableError = error && (
                (typeof error === 'object' && 'name' in error && errorTypesToRetry.includes(error.name)) ||
                (typeof error === 'object' && 'errorType' in error && errorTypesToRetry.includes(error.errorType)) ||
                (error.constructor && errorTypesToRetry.includes(error.constructor.name))
            );
            
            if (isRetryableError && retries < maxRetries) {
                const errorName = error.name || error.errorType || error.constructor?.name || 'Unknown';
                console.log(`${errorName} detected, retry attempt ${retries + 1}/${maxRetries} after ${delayMs}ms delay`);
                retries++;
                // Wait for the specified delay
                await new Promise(resolve => setTimeout(resolve, delayMs));
                // Continue to next iteration for retry
            } else {
                // Either not a retryable error or we've exhausted retries
                if (retries >= maxRetries) {
                    console.log(`Max retries (${maxRetries}) exceeded for error:`, error);
                }
                throw error;
            }
        }
    }
}

interface Arguments {
    sessionId: string;
    human: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionAttributes?: Record<string, any>;
}

const bedrockAgentClient = new BedrockAgentRuntimeClient({});

export const handler = async (event: AppSyncResolverEvent<Arguments>) => {
    return await retryWithBackoff(
        async () => {
            const { sessionId, human, sessionAttributes } = event.arguments;
            const { username } = event.identity as AppSyncIdentityCognito;

            const graphqlClient = new AWSAppSyncClient({
                url: process.env.GRAPH_API_URL!,
                region: process.env.AWS_REGION!,
                auth: {
                    type: AUTH_TYPE.AMAZON_COGNITO_USER_POOLS,
                    jwtToken: event.request.headers.authorization!,
                },
                disableOffline: true,
            });

            const command = new InvokeAgentCommand({
                agentId: process.env.AGENT_ID,
                agentAliasId: process.env.AGENT_ALIAS_ID,
                inputText: human,
                sessionId: sessionId,
                enableTrace: true,
                streamingConfigurations: {
                    streamFinalResponse: true,
                },
                sessionState: {
                    sessionAttributes: {
                        username,
                        ...sessionAttributes,
                    },
                },
            });

            const agentResponse = await bedrockAgentClient.send(command);
            let assistant = "";

            if (agentResponse.completion) {
                const { id } = (
                    (await graphqlClient.mutate({
                        mutation: gql`
                            ${createChat}
                        `,
                        variables: {
                            input: {
                                sessionId,
                                expiration: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours from now
                            },
                        } as CreateChatMutationVariables,
                    })) as { data: CreateChatMutation }
                ).data.createChat!;

                for await (const response of agentResponse.completion) {
                    assistant += new TextDecoder().decode(response.chunk?.bytes);

                    await graphqlClient.mutate({
                        mutation: gql`
                            ${updateChat}
                        `,
                        variables: {
                            input: {
                                id,
                                human,
                                assistant,
                                trace: JSON.stringify(response.trace),
                            },
                        } as UpdateChatMutationVariables,
                    });
                }
            }

            return assistant;
        },
        5,  // Maximum of 5 retries
        10000,  // 5 second delay between retries
        ["ThrottlingException"]  // Only retry on this specific error
    );
};

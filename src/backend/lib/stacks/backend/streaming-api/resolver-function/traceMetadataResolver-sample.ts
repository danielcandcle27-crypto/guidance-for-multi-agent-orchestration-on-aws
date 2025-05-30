/**
 * Sample Lambda function showing how to process trace data with the new traceMetadata field
 * 
 * This function demonstrates how to handle both the original trace field (for backward compatibility)
 * and the new traceMetadata field that includes all agent metadata for proper identification.
 */
import { AppSyncResolverEvent } from 'aws-lambda';

/**
 * Process a trace event and return both the legacy trace field and new traceMetadata field
 */
exports.handler = async (event: AppSyncResolverEvent<any>) => {
  // Extract the incoming trace data from the event
  const traceData = event.arguments?.trace || {};
  
  try {
    // For this example, assume traceData contains fields like:
    // {
    //   agentId: string,
    //   agentName: string,
    //   collaboratorName: string,
    //   trace: { /* actual trace details */ }
    // }

    // Create the full trace response with the complete structure
    const fullTraceResponse = {
      agentId: traceData.agentId || "unknown",
      agentName: traceData.agentName || traceData.collaboratorName || "unknown",
      collaboratorName: traceData.collaboratorName || traceData.agentName || "unknown", 
      agentAliasId: traceData.agentAliasId || null,
      sessionId: event.arguments.sessionId,
      agentVersion: traceData.agentVersion || "1.0",
      trace: traceData.trace || traceData, // Store the actual trace content
      callerChain: traceData.callerChain || []
    };

    // For backward compatibility: Still store the inner trace field
    const legacyTraceJson = JSON.stringify(traceData.trace || {});
    
    // For the fix: Store the complete trace response with all metadata intact
    // This preserves the full structure for downstream processing
    const fullTraceMetadataJson = JSON.stringify(fullTraceResponse);

    console.log("Storing complete trace metadata:", fullTraceResponse);

    // You would use your actual database client or API calls here
    // This is just a simplified example of the update operation
    const result = await updateChatItem({
      // Your normal parameters
      sessionId: event.arguments.sessionId,
      // Include both fields in the update
      trace: legacyTraceJson,          // Keep for backward compatibility
      traceMetadata: fullTraceMetadataJson  // Add new field with complete data structure
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Trace data processed successfully',
        sessionId: event.arguments.sessionId
      })
    };
  } catch (error: any) {
    console.error('Error processing trace:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing trace data',
        error: error.message || String(error)
      })
    };
  }
};

/**
 * Mock function representing your database update operation
 * Replace this with your actual implementation
 */
async function updateChatItem(params: any) {
  // This would be your actual database client call
  // For example with DynamoDB:
  /*
  const result = await dynamoDbClient.update({
    TableName: 'ChatTable',
    Key: { sessionId: params.sessionId },
    UpdateExpression: 'SET trace = :trace, traceMetadata = :traceMetadata',
    ExpressionAttributeValues: {
      ':trace': params.trace,
      ':traceMetadata': params.traceMetadata
    }
  }).promise();
  return result;
  */
  
  // For this example, just return a mock success response
  return { success: true };
}

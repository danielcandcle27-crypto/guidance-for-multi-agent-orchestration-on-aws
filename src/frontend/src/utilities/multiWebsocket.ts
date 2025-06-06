// multiWebsocket.ts - Utility for managing multiple websocket connections and message handlers
import { fetchAuthSession } from 'aws-amplify/auth';

interface MessageHandler {
  type: string;
  handler: (data: any) => void;
}

// Store connections by session ID - exported for cleanup during sign-out
export const connections: Record<string, WebSocket> = {};

// Store message handlers by connection ID
const handlers: Record<string, MessageHandler[]> = {};

// Generate a stable connection ID based on session and model
export const generateConnectionId = (sessionId: string, modelId?: string): string => {
  return `${sessionId}${modelId ? `-${modelId}` : ''}`;
};

// Parse trace data from websocket messages
export const parseTraceData = (data: any): any => {
  if (!data) return null;
  
  try {
    // Defensive check for null data.onUpdateChat
    if (!data.onUpdateChat) {
      console.debug('parseTraceData: data.onUpdateChat is null or undefined');
      return null;
    }
    
    // First check for the new traceMetadata field which contains the full structure
    if (data.onUpdateChat.traceMetadata) {
      const traceMetadata = data.onUpdateChat.traceMetadata;
      
      // Parse string traceMetadata to JSON if needed
      if (typeof traceMetadata === 'string') {
        try {
          // Return the full object as-is without modification - this contains the complete structure:
          // {
          //   agentId: string,
          //   agentName: string,
          //   collaboratorName: string,
          //   agentAliasId: string, 
          //   sessionId: string,
          //   agentVersion: string,
          //   trace: { ... },
          //   callerChain: [...]
          // }
          return JSON.parse(traceMetadata);
        } catch (e) {
          console.error('Error parsing traceMetadata JSON string:', e);
          console.log('Raw traceMetadata string:', traceMetadata.substring(0, 200) + '...');
          // Fall through to try the legacy trace field
        }
      } else {
        // Return object as-is if already parsed
        return traceMetadata;
      }
    }
    
    // Fall back to the legacy trace field for backward compatibility
    if (data.onUpdateChat?.trace) {
      const traceData = data.onUpdateChat.trace;
      
      // Parse string traces to JSON if needed
      if (typeof traceData === 'string') {
        try {
          // For legacy format, we need to construct a similar structure
          const parsedTrace = JSON.parse(traceData);
          // Construct a compatible object with the same shape for backward compatibility
          return { 
            // These fields might not be available in legacy format
            agentId: parsedTrace.agentId || 'unknown',
            agentName: parsedTrace.agentName || parsedTrace.collaboratorName || 'unknown',
            collaboratorName: parsedTrace.collaboratorName || parsedTrace.agentName || 'unknown',
            sessionId: data.onUpdateChat?.sessionId || 'unknown',
            trace: parsedTrace
          };
        } catch (e) {
          console.error('Error parsing trace JSON string:', e);
          return { trace: traceData };
        }
      }
      
      // Return trace data as-is but wrap it in the expected structure
      return {
        trace: traceData,
        // Add unknown values for backward compatibility
        agentId: 'unknown',
        agentName: 'unknown',
        collaboratorName: 'unknown'
      };
    }
    
    // Handle direct trace format
    if (data.content?.trace) {
      const traceContent = data.content;
      
      // Parse string traces to JSON if needed
      if (typeof traceContent.trace === 'string') {
        try {
          traceContent.trace = JSON.parse(traceContent.trace);
        } catch (e) {
          console.error('Error parsing trace JSON string:', e);
        }
      }
      
      return traceContent;
    }
    
    // Handle collaborator info in message
    if (data.collaboratorName || data.agentName) {
      return data;
    }
    
    // If no trace data found, return null
    return null;
  } catch (error) {
    console.error('Error in parseTraceData:', error);
    return null;
  }
};

// Track connection attempts to prevent too many simultaneous connections
const connectionAttempts: Record<string, number> = {};
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second initial retry delay
const CONNECTION_TIMEOUT = 5000; // 5 second timeout

// Connect to websocket with retry logic
export const connectWebSocket = async (
  sessionId: string, 
  modelId?: string,
  onConnect?: () => void
): Promise<WebSocket | null> => {
  try {
    // Check if connection already exists
    const connId = generateConnectionId(sessionId, modelId);
    
    // Return existing connection if it's open or connecting
    if (connections[connId]) {
      if (connections[connId].readyState === WebSocket.OPEN) {
        console.log(`Using existing open websocket connection for ${connId}`);
        return connections[connId];
      }
      else if (connections[connId].readyState === WebSocket.CONNECTING) {
        console.log(`Connection already in progress for ${connId}, waiting...`);
        return connections[connId];
      }
    }
    
    // Check if we've exceeded retry attempts
    if (connectionAttempts[connId] && connectionAttempts[connId] >= MAX_RETRIES) {
      console.log(`Maximum connection attempts (${MAX_RETRIES}) reached for ${connId}`);
      return null;
    }
    
    // Track this attempt
    connectionAttempts[connId] = (connectionAttempts[connId] || 0) + 1;
    
    // Determine WS URL with enhanced approach
    // First try development proxy URL
    let wsUrl = '';
    
    // If there's an explicit WebSocket endpoint defined in the environment, use that first
    if (import.meta.env.VITE_WEBSOCKET_ENDPOINT) {
      // Important: For AppSync, do NOT append sessionId to WebSocket URL
      wsUrl = import.meta.env.VITE_WEBSOCKET_ENDPOINT;
      console.log(`🌐 Using explicit WebSocket endpoint: ${wsUrl}`);
    } 
    // Otherwise use automatic URL construction
    else if (process.env.NODE_ENV === 'development') {
      // Development: proxy through the development server to avoid CORS
      wsUrl = `ws://${window.location.host}/api/ws/${sessionId}`;
      console.log(`🌐 Using development proxy WebSocket URL: ${wsUrl}`);
    } else {
      // Production: use protocol-relative URL based on current connection
      wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/${sessionId}`;
      console.log(`🌐 Using production WebSocket URL: ${wsUrl}`);
    }
    
    console.log(`⚠️ DEBUG - WebSocket connection attempt details:`);
    console.log(`  URL: ${wsUrl}`);
    console.log(`  Attempt: ${connectionAttempts[connId]}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log(`  Model ID: ${modelId || 'not provided'}`);
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    
    // Get authentication credentials for AppSync before creating WebSocket
    let authenticatedWsUrl = wsUrl;
    
    try {
      // Get the current authenticated session
      const session = await fetchAuthSession();
      
      // Extract auth token if available (for Cognito User Pool authentication)
      // Try both access token and ID token for compatibility
      if (session && session.tokens) {
        const idToken = session.tokens.idToken?.toString();
        const accessToken = session.tokens.accessToken?.toString();
        
        // Use ID token first (recommended for AppSync), fallback to access token
        const authToken = idToken || accessToken;
        
        if (authToken) {
          console.log('✅ Authentication token obtained for WebSocket connection', {
            tokenType: idToken ? 'ID Token' : 'Access Token',
            tokenLength: authToken.length
          });
        
          // Create authorization header object for AppSync
          // Extract the actual GraphQL API hostname (not the realtime endpoint)
          const graphApiUrl = import.meta.env.VITE_GRAPH_API_URL || wsUrl.replace('-realtime', '');
          
          // AppSync expects specific header format - use the full host including protocol
          const authHeader = {
            host: new URL(graphApiUrl).host, // Use host, not hostname (includes port if specified)
            Authorization: authToken,  // No "Bearer" prefix needed for Cognito User Pool
            'x-api-key': import.meta.env.VITE_GRAPH_API_KEY || '' // Include API key if available
          };
          
          // Base64 encode the authorization header - with proper handling to avoid URL encoding issues
          const authHeaderString = JSON.stringify(authHeader);
          const encodedAuth = btoa(unescape(encodeURIComponent(authHeaderString))); // Handle UTF-8 characters properly
          
          // Add encoded auth as query parameter (AppSync standard approach)
          authenticatedWsUrl = `${wsUrl}?header=${encodedAuth}`;
          
          // Debug logging (without exposing sensitive token)
          console.log('🔐 WebSocket authentication details:', {
            graphApiHost: new URL(graphApiUrl).hostname,
            authHeaderStructure: {
              host: authHeader.host,
              hasAuthorization: !!authHeader.Authorization,
              tokenLength: authToken.length
            },
            encodedAuthLength: encodedAuth.length
          });
        } else {
          console.log('⚠️ No authentication tokens available in session');
        }
      } else {
        console.log('⚠️ No authentication token available, proceeding with unauthenticated connection');
      }
    } catch (authError) {
      console.warn('⚠️ Could not retrieve authentication token:', authError);
    }
    
    // Create new connection with proper protocol for AppSync
    const ws = new WebSocket(authenticatedWsUrl, ['graphql-ws']);
    
    // Log the protocol in use
    console.log(`🌐 WebSocket connection using protocol: graphql-ws`);
    
    // Add connection timeout
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log(`Connection timed out for ${connId}`);
        ws.close();
      }
    }, CONNECTION_TIMEOUT);
    
    // Set up listeners
    ws.onopen = async () => {
      console.log(`Websocket connection opened for ${connId}`);
      
      // Send AppSync GraphQL initialization message
      try {
        // Send simplified connection_init message (auth already handled in URL)
        const gqlInitMsg = {
          type: 'connection_init'
        };
        
        // Log the initialization message
        console.log(`📤 SENDING GQL CONNECTION INIT on ${connId}`);
        ws.send(JSON.stringify(gqlInitMsg));
        
        // Then send our application-specific connection message
        const connectMsg = {
          type: 'connect',
          sessionId,
          modelId,
          timestamp: Date.now()
        };
        
        // Log outgoing message
        console.log(`📤 MESSAGE SENT on ${connId}:`, {
          type: connectMsg.type,
          sessionId: connectMsg.sessionId,
          timestamp: new Date(connectMsg.timestamp).toISOString()
        });
        
        ws.send(JSON.stringify(connectMsg));
        
        // Call the onConnect callback if provided
        if (onConnect) onConnect();
      } catch (e) {
        console.error('Error sending connection messages:', e);
      }
      
      // Wrap the original send method to add logging
      const originalSend = ws.send;
      ws.send = function(data) {
        try {
          // Try to parse if it's a string to log it
          if (typeof data === 'string') {
            try {
              const parsedData = JSON.parse(data);
              console.log(`📤 MESSAGE SENT on ${connId}:`, {
                type: parsedData.type || 'unknown',
                hasUserMessage: !!parsedData.message,
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              // Not JSON, log as is
              console.log(`📤 MESSAGE SENT on ${connId}: [raw data]`);
            }
          } else {
            console.log(`📤 MESSAGE SENT on ${connId}: [binary data]`);
          }
        } catch (e) {
          console.error('Error in send wrapper:', e);
        }
        
        // Call the original send method
        return originalSend.apply(this, arguments);
      };
    };
    
    // Handle messages by dispatching to registered handlers plus a DOM event
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle AppSync specific connection messages
        if (data.type === 'connection_ack') {
          console.log(`🌟 AppSync connection acknowledged for ${connId}`);
          // If needed, start the subscription here - using proper AppSync format
          // Format the subscription based on AppSync real-time API requirements
          // Make sure to include both the query and variables in the correct format
          const startMsg = {
            id: '1',
            type: 'start',
            payload: {
              // Full GraphQL query including all field selections based on schema
              query: `subscription OnUpdateChat($filter: ModelSubscriptionChatFilterInput) {
                onUpdateChat(filter: $filter) {
                  userId
                  sessionId
                  human
                  assistant
                  trace
                  traceMetadata
                  expiration
                }
              }`,
              variables: {
                filter: {
                  sessionId: {
                    eq: sessionId
                  }
                }
              },
              // Include extensions for AppSync
              extensions: {
                authorization: {
                  host: new URL(import.meta.env.VITE_GRAPH_API_URL || '').host,
                  Authorization: 'Bearer ${token}' // Placeholder will be replaced by AppSync using the header
                }
              }
            }
          };
          ws.send(JSON.stringify(startMsg));
          console.log(`📩 Sent subscription start message for ${connId}`);
          
          // Continue with regular message processing
        } else if (data.type === 'connection_error') {
          console.error(`❌ AppSync connection error for ${connId}:`, data.payload || 'No error details provided');
          
          // Log specific error details for debugging
          if (data.payload) {
            console.error('🔍 Error details:', {
              message: data.payload.message || 'No message',
              errorType: data.payload.errorType || 'Unknown error type',
              errors: data.payload.errors || []
            });
            
            // Check for specific authentication errors
            if (data.payload.message && data.payload.message.includes('Required headers are missing')) {
              console.error('💡 Authentication header issue detected. Check:');
              console.error('   - Cognito User Pool token is valid');
              console.error('   - Host header matches GraphQL API endpoint');
              console.error('   - Base64 encoding is correct');
            }
          }
          
          // Don't proceed with further processing in case of connection error
          return;
        } else if (data.type === 'ka') {
          // Keep-alive message, just acknowledge silently
          console.debug(`💌 Received keep-alive for ${connId}`);
        }
        
        // Log raw data with special prefix for easy filtering
        console.log("%cRAW DATA: AppSync/GraphQL Response", "background: #333; color: #bada55; padding: 2px;", data);
        
        // Enhanced logging for received messages with defensive null checks
        console.log(`📥 MESSAGE RECEIVED on ${connId}:`, {
          type: data?.type || 'unknown',
          hasTrace: Boolean(data?.onUpdateChat?.trace),
          hasTraceMetadata: Boolean(data?.onUpdateChat?.traceMetadata),
          hasAssistantResponse: Boolean(data?.onUpdateChat?.assistant),
          timestamp: new Date().toISOString()
        });
        
        // Special logging for assistant responses
        if (data.onUpdateChat?.assistant) {
          const responseText = data.onUpdateChat.assistant;
          const previewLength = 100; // Show first 100 chars as preview
          const preview = responseText.length > previewLength ? 
            `${responseText.substring(0, previewLength)}...` : 
            responseText;
          
          console.log(`💬 ASSISTANT RESPONSE on ${connId}:`, {
            length: responseText.length,
            preview: preview,
            isFinalResponse: responseText.includes("Can I help you with anything else?") || 
                            responseText.includes("Is there anything else") ||
                            responseText.includes("In conclusion") ||
                            responseText.includes("To summarize")
          });
        }
        
        // Create a DOM event that components can listen for
        const messageEvent = new MessageEvent('message', {
          data: event.data
        });
        window.dispatchEvent(messageEvent);
        
        // Dispatch to registered handlers
        if (handlers[connId]) {
          handlers[connId].forEach(handler => {
            try {
              // Check if this message matches the handler type
              if (data.type === handler.type || handler.type === '*') {
                handler.handler(data);
              }
              
              // Also check for trace data in onUpdateChat (either trace or traceMetadata)
              if (handler.type === 'trace' && 
                 (data.onUpdateChat?.trace || data.onUpdateChat?.traceMetadata)) {
                
                // Determine which trace data to use (prefer traceMetadata)
                const traceSource = data.onUpdateChat?.traceMetadata ? 'traceMetadata' : 'trace';
                const traceData = data.onUpdateChat[traceSource];
                
            // Check if traceData exists before logging or accessing its properties
            if (traceData) {
              // Log trace data when handling it
              console.log(`🔍 TRACE DATA on ${connId} (source: ${traceSource}):`, {
                collaborator: typeof traceData === 'object' ? 
                  (traceData.collaboratorName || 'Unknown') : 'String trace',
                agentName: typeof traceData === 'object' ? 
                  (traceData.agentName || 'Unknown') : 'N/A',
                traceType: typeof traceData === 'string' ? 'string' : 'object',
                length: typeof traceData === 'string' ? 
                  traceData.length : 
                  JSON.stringify(traceData || {}).length
              });
            } else {
              console.warn(`⚠️ Empty trace data received from ${traceSource}`);
            }
                
                handler.handler(data);
              }
            } catch (e) {
              console.error(`Error in message handler for ${connId}:`, e);
            }
          });
        }
      } catch (e) {
        console.error('Error parsing websocket message:', e);
      }
    };
    
    ws.onclose = () => {
      console.log(`Websocket connection closed for ${connId}`);
      delete connections[connId];
    };
    
    ws.onerror = (error) => {
      // Downgrade to warning and improve the message to be less alarming
      // These are often normal connection lifecycle events
      console.warn(`⚠️ WebSocket connection issue for ${connId} - This is usually expected and does not affect functionality`);
      
      // Log details at debug level only - not as an error
      console.debug('WebSocket event details:', error);
    };
    
    // Store and return the connection
    connections[connId] = ws;
    return ws;
  } catch (e) {
    console.error('Error connecting to websocket:', e);
    return null;
  }
};

// Register a message handler
export const registerMessageHandler = (
  connectionId: string,
  type: string,
  handler: (data: any) => void
): void => {
  // Initialize handlers array if needed
  if (!handlers[connectionId]) {
    handlers[connectionId] = [];
  }
  
  // Add handler
  handlers[connectionId].push({ type, handler });
  console.log(`Registered ${type} handler for ${connectionId}`);
};

// Unregister a message handler
export const unregisterMessageHandler = (
  connectionId: string,
  type: string,
  handler: (data: any) => void
): void => {
  if (handlers[connectionId]) {
    // Find and remove the handler
    const index = handlers[connectionId].findIndex(
      h => h.type === type && h.handler === handler
    );
    
    if (index !== -1) {
      handlers[connectionId].splice(index, 1);
      console.log(`Unregistered ${type} handler for ${connectionId}`);
    }
  }
};

// Check if a websocket is connected
export const isWebSocketConnected = (): boolean => {
  return Object.values(connections).some(ws => ws.readyState === WebSocket.OPEN);
};

// Debug helper function to diagnose connection issues
export const debugWebSocketConnection = async (sessionId: string): Promise<void> => {
  console.log('🔍 DEBUGGING WEBSOCKET CONNECTION');
  
  try {
    // Check environment variables
    console.log('Environment variables check:');
    console.log('- WEBSOCKET_ENDPOINT:', import.meta.env.VITE_WEBSOCKET_ENDPOINT ? '✅ Set' : '❌ Missing');
    console.log('- GRAPH_API_URL:', import.meta.env.VITE_GRAPH_API_URL ? '✅ Set' : '❌ Missing');
    console.log('- GRAPH_API_KEY:', import.meta.env.VITE_GRAPH_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('- USER_POOL_ID:', import.meta.env.VITE_USER_POOL_ID ? '✅ Set' : '❌ Missing');
    
    // Check auth session
    try {
      const session = await fetchAuthSession();
      console.log('Auth session check:');
      console.log('- Session object:', session ? '✅ Available' : '❌ Missing');
      console.log('- ID Token:', session.tokens?.idToken ? '✅ Available' : '❌ Missing');
      console.log('- Access Token:', session.tokens?.accessToken ? '✅ Available' : '❌ Missing');
    } catch (error) {
      console.log('❌ Failed to get auth session:', error);
    }
    
    // Analyze URLs
    if (import.meta.env.VITE_GRAPH_API_URL && import.meta.env.VITE_WEBSOCKET_ENDPOINT) {
      const graphApiUrl = import.meta.env.VITE_GRAPH_API_URL;
      const wsUrl = import.meta.env.VITE_WEBSOCKET_ENDPOINT;
      
      console.log('URL consistency check:');
      const graphApiId = graphApiUrl.match(/https:\/\/([^.]+)/)?.[1];
      const wsApiId = wsUrl.match(/wss:\/\/([^.]+)/)?.[1];
      
      if (graphApiId && wsApiId) {
        console.log('- API IDs match:', graphApiId === wsApiId ? '✅ Yes' : '❌ No');
        if (graphApiId !== wsApiId) {
          console.log(`  GraphQL API ID: ${graphApiId}`);
          console.log(`  WebSocket API ID: ${wsApiId}`);
        }
      }
      
      console.log('- GraphQL URL is for AppSync:', graphApiUrl.includes('appsync-api') ? '✅ Yes' : '❌ No');
      console.log('- WebSocket URL is for AppSync Realtime:', wsUrl.includes('appsync-realtime') ? '✅ Yes' : '❌ No');
    }
    
    console.log('🔍 DEBUG COMPLETE - Check the log for issues');
  } catch (error) {
    console.error('Error in debug function:', error);
  }
};

// Export default for compatibility
export default {
  connectWebSocket,
  registerMessageHandler,
  unregisterMessageHandler,
  generateConnectionId,
  isWebSocketConnected,
  parseTraceData,
  debugWebSocketConnection
};

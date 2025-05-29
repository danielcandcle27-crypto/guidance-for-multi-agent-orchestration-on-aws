// multiWebsocket.ts - Utility for managing multiple websocket connections and message handlers

interface MessageHandler {
  type: string;
  handler: (data: any) => void;
}

// Store connections by session ID
const connections: Record<string, WebSocket> = {};

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
    // First check for the new traceMetadata field which contains the full structure
    if (data.onUpdateChat?.traceMetadata) {
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
export const connectWebSocket = (
  sessionId: string, 
  modelId?: string,
  onConnect?: () => void
): WebSocket | null => {
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
    
    // Determine WS URL - for development, use a relative path that will proxy
    // through the development server to avoid CORS issues
    const wsUrl = process.env.NODE_ENV === 'development' 
      ? `ws://${window.location.host}/api/ws/${sessionId}` 
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/${sessionId}`;
    
    console.log(`Creating new websocket connection to ${wsUrl} (attempt ${connectionAttempts[connId]})`);
    
    // Create new connection
    const ws = new WebSocket(wsUrl);
    
    // Add connection timeout
    const timeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log(`Connection timed out for ${connId}`);
        ws.close();
      }
    }, CONNECTION_TIMEOUT);
    
    // Set up listeners
    ws.onopen = () => {
      console.log(`Websocket connection opened for ${connId}`);
      if (onConnect) onConnect();
      
      // Send a connection message
      try {
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
      } catch (e) {
        console.error('Error sending connect message:', e);
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
        
        // Log raw data with special prefix for easy filtering
        console.log("%cRAW DATA: AppSync/GraphQL Response", "background: #333; color: #bada55; padding: 2px;", data);
        
        // Enhanced logging for received messages
        console.log(`📥 MESSAGE RECEIVED on ${connId}:`, {
          type: data.type || 'unknown',
          hasTrace: !!data.onUpdateChat?.trace,
          hasTraceMetadata: !!data.onUpdateChat?.traceMetadata,
          hasAssistantResponse: !!data.onUpdateChat?.assistant,
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
                
                // Log trace data when handling it
                console.log(`🔍 TRACE DATA on ${connId} (source: ${traceSource}):`, {
                  collaborator: typeof traceData === 'object' ? 
                    traceData.collaboratorName || 'Unknown' : 'String trace',
                  agentName: typeof traceData === 'object' ? 
                    traceData.agentName || 'Unknown' : 'N/A',
                  traceType: typeof traceData === 'string' ? 'string' : 'object',
                  length: typeof traceData === 'string' ? 
                    traceData.length : 
                    JSON.stringify(traceData).length
                });
                
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

// Export default for compatibility
export default {
  connectWebSocket,
  registerMessageHandler,
  unregisterMessageHandler,
  generateConnectionId,
  isWebSocketConnected,
  parseTraceData
};

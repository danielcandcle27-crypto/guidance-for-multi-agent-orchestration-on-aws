// diagnostic.js - WebSocket connection diagnostic script
// Import the multiWebsocket utilities for testing
import { connectWebSocket, debugWebSocketConnection, generateConnectionId } from './src/utilities/multiWebsocket';
import { v4 as uuidv4 } from 'uuid';

// Main diagnostic function
export async function diagnoseWebSocketConnection() {
  console.log('🔧 Starting WebSocket Connection Diagnostics');
  console.log('===========================================');
  
  // Create a unique session ID for testing
  const sessionId = uuidv4();
  console.log(`Generated test session ID: ${sessionId}`);
  
  try {
    // Run the environment and auth checks
    await debugWebSocketConnection(sessionId);
    
    // Test creating an actual connection
    console.log('\n🔌 Testing WebSocket Connection:');
    const ws = await connectWebSocket(sessionId);
    
    if (ws) {
      console.log('✅ WebSocket connection created successfully');
      console.log('WebSocket readyState:', getReadyStateText(ws.readyState));
      
      // Register a test message handler
      const connId = generateConnectionId(sessionId);
      console.log(`Setting up test message handler for ${connId}`);
      
      // Create a one-time message handler to verify communication works
      const messageHandler = (data) => {
        console.log('✅ TEST MESSAGE RECEIVED:', data);
        console.log('Connection test successful - messages can be received!');
      };
      
      // Add event listener directly on the WebSocket
      ws.addEventListener('message', (event) => {
        try {
          console.log('📥 Raw message received during test:', event.data);
        } catch (e) {
          console.error('Error handling raw message:', e);
        }
      });
      
      // Force error handler to catch any WebSocket errors
      ws.addEventListener('error', (error) => {
        console.error('❌ WebSocket Error during test:', error);
      });

      // Wait a bit to see if we get any messages
      console.log('Waiting 5 seconds to check for messages...');
      
      return new Promise((resolve) => {
        setTimeout(() => {
          // Check final connection state
          if (ws.readyState === WebSocket.OPEN) {
            console.log('✅ Connection remains open after 5 seconds');
            console.log('🎉 Diagnostic complete - Connection appears to be working!');
            resolve(true);
          } else {
            console.log('❌ Connection is no longer open:', getReadyStateText(ws.readyState));
            console.log('🔍 Diagnostic complete - Connection issues detected');
            resolve(false);
          }
        }, 5000);
      });
    } else {
      console.log('❌ Failed to create WebSocket connection');
      return false;
    }
  } catch (error) {
    console.error('❌ Error during WebSocket diagnostics:', error);
    return false;
  }
}

// Helper function to convert WebSocket readyState to text
function getReadyStateText(readyState) {
  switch(readyState) {
    case WebSocket.CONNECTING: return 'CONNECTING (0)';
    case WebSocket.OPEN: return 'OPEN (1)';
    case WebSocket.CLOSING: return 'CLOSING (2)';
    case WebSocket.CLOSED: return 'CLOSED (3)';
    default: return `UNKNOWN (${readyState})`;
  }
}

// Function to test AppSync header formatting
export function testAppSyncHeaderFormat() {
  console.log('🔍 Testing AppSync Header Formatting');
  
  // Test data
  const testToken = "test_token_value";
  const testApiUrl = import.meta.env.VITE_GRAPH_API_URL || "https://example.appsync-api.region.amazonaws.com/graphql";
  
  try {
    // Create authentication header object
    const authHeader = {
      host: new URL(testApiUrl).host,
      Authorization: testToken,
      'x-api-key': import.meta.env.VITE_GRAPH_API_KEY || ''
    };
    
    // Base64 encode the authorization header
    const authHeaderString = JSON.stringify(authHeader);
    const encodedAuth = btoa(unescape(encodeURIComponent(authHeaderString)));
    
    // Log results
    console.log('Test Results:');
    console.log('- Original Header:', authHeader);
    console.log('- JSON String:', authHeaderString);
    console.log('- Base64 Encoded:', encodedAuth);
    console.log('- URL with query param:', `wss://example.com?header=${encodedAuth}`);
    
    return {
      authHeader,
      authHeaderString,
      encodedAuth
    };
  } catch (error) {
    console.error('❌ Error testing AppSync header format:', error);
    return null;
  }
}

// Run the diagnostic if called directly
if (typeof window !== 'undefined') {
  // Expose to window to allow running from console
  window.diagnoseWebSocket = diagnoseWebSocketConnection;
  window.testAppSyncHeader = testAppSyncHeaderFormat;
  
  console.log('🔧 WebSocket diagnostic tools loaded');
  console.log('Run diagnoseWebSocket() to test the connection');
  console.log('Run testAppSyncHeader() to test header formatting');
}

export default {
  diagnoseWebSocketConnection,
  testAppSyncHeaderFormat
};

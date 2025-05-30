# WebSocket Connection Fixes

This document explains the fixes implemented to resolve the AppSync WebSocket connection errors:
```
multiWebsocket.ts:356 ❌ AppSync connection error for [session-id]-us.amazon.nova-micro-v1:0: 
{errors: Array(1)}
errors: Array(1)
0: {message: 'Required headers are missing.', errorCode: 400}
```

## Root Cause

The primary issues fixed were:

1. **Incorrect header format in AppSync WebSocket connections**: 
   - Using `.hostname` instead of `.host` in the request headers
   - Missing required `x-api-key` header for API key authentication
   - Improper base64 encoding of headers that didn't handle UTF-8 characters

2. **Incorrect subscription payload format**:
   - Missing complete query fields in the subscription
   - Missing required authorization extensions in the payload

3. **Missing API Key in environment variables**:
   - Added `VITE_GRAPH_API_KEY` to the `.env` file
   - Configured Amplify to use API key authentication when needed

## Files Modified

1. `src/frontend/src/utilities/multiWebsocket.ts`:
   - Fixed authentication header creation with proper host format
   - Added x-api-key header support
   - Fixed base64 encoding with proper UTF-8 handling
   - Enhanced subscription message format with complete fields and extensions

2. `src/frontend/src/App.tsx`:
   - Updated Amplify configuration to include API key support
   - Set proper auth modes for GraphQL operations

3. `src/frontend/.env`:
   - Added `VITE_GRAPH_API_KEY` variable

## Diagnostic Tools Added

1. `src/frontend/diagnostic.js`:
   - WebSocket connection testing utility
   - Header format testing functions
   - Provides debug logs to identify connection issues

2. `debugWebSocketConnection()` function in `multiWebsocket.ts`:
   - Environment variable checks
   - Auth session validation
   - URL consistency validation

## How to Use the Diagnostic Tools

### Running the Diagnostic Script

1. Run the diagnostic server:
   ```bash
   ./src/frontend/run-diagnostics.sh
   ```

2. Open the browser's developer console

3. Run the diagnostic functions:
   ```javascript
   // Test the WebSocket connection
   diagnoseWebSocket();

   // Test header formatting
   testAppSyncHeader();
   ```

### Interpreting the Results

The diagnostic tools will provide detailed information about:

- Environment variable configuration
- Authentication status
- WebSocket connection establishment
- Header formatting and encoding
- Subscription message processing

Look for the "✅" and "❌" symbols to identify what's working and what's not.

## How AppSync WebSocket Authentication Works

AppSync WebSockets require authentication via headers that are base64-encoded and sent as a query parameter:

1. Create an authentication header object:
   ```javascript
   const authHeader = {
     host: "your-api-id.appsync-api.region.amazonaws.com", // Include full host (not just hostname)
     Authorization: "your-auth-token",                     // No "Bearer" prefix for Cognito tokens
     "x-api-key": "your-api-key"                          // Required when using API key auth
   };
   ```

2. Encode this header object:
   ```javascript
   const encodedAuth = btoa(unescape(encodeURIComponent(JSON.stringify(authHeader))));
   ```

3. Add as query parameter:
   ```javascript
   const url = `wss://your-api-id.appsync-realtime-api.region.amazonaws.com/graphql?header=${encodedAuth}`;
   ```

4. When establishing the subscription, include proper extensions:
   ```javascript
   const startMsg = {
     id: '1',
     type: 'start',
     payload: {
       query: "subscription { ... }",
       variables: { ... },
       extensions: {
         authorization: {
           host: "your-api-id.appsync-api.region.amazonaws.com",
           Authorization: "Bearer ${token}" // Placeholder - AppSync replaces this
         }
       }
     }
   };
   ```

## Troubleshooting Guide

If WebSocket connection issues occur again:

1. Check the browser console for error messages
   - Look for "Required headers are missing" errors
   - Verify authentication token availability

2. Run the diagnostic tools
   ```javascript
   diagnoseWebSocket();
   ```

3. Verify environment variables are correctly set:
   - `VITE_WEBSOCKET_ENDPOINT`
   - `VITE_GRAPH_API_URL`
   - `VITE_GRAPH_API_KEY`

4. Check that all URLs are consistent:
   - GraphQL API URL and WebSocket URL should use the same API ID
   - Ensure the WebSocket URL has the correct format with "-realtime"

5. Verify authentication is working:
   - Check Cognito configuration
   - Verify tokens are being refreshed properly
   - Try using API key authentication as a fallback

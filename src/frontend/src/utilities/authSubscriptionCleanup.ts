// authSubscriptionCleanup.ts - Utility to clean up subscriptions when signing out
import { connections } from './multiWebsocket';

// This will be used to track if a sign-out is in progress
let isSigningOut = false;

/**
 * Set the signing out state to prevent error messages during sign-out
 * @param signingOut - Whether a sign-out operation is currently in progress
 */
export const setSigningOutState = (signingOut: boolean): void => {
  isSigningOut = signingOut;
  
  if (signingOut) {
    // Log the start of the sign-out process
    console.log('🚪 Sign-out process started - cleaning up subscriptions');
    
    // Intercept and silence auth-related errors during sign-out
    const originalConsoleError = console.error;
    console.error = function(...args) {
      // Check if this is an auth-related error during sign-out
      const errorMsg = args.join(' ');
      if (isSigningOut && (
          errorMsg.includes('authentication') || 
          errorMsg.includes('auth') ||
          errorMsg.includes('UserUnAuthenticated') ||
          errorMsg.includes('subscription')
      )) {
        // Suppress auth errors during sign-out to prevent console noise
        console.log('⚠️ Suppressed auth error during sign-out:', ...args);
        return;
      }
      
      // Otherwise, pass through to original console.error
      originalConsoleError.apply(console, args);
    };
    
    // Restore original console.error after a brief delay (after sign-out completes)
    setTimeout(() => {
      console.error = originalConsoleError;
      console.log('🔄 Restored error handling after sign-out');
    }, 2000);
  } else {
    console.log('🔄 Sign-out process completed');
  }
};

/**
 * Check if a sign-out operation is in progress
 * Used by error handlers to suppress error messages during sign-out
 */
export const isSigningOutInProgress = (): boolean => {
  return isSigningOut;
};

/**
 * Close all active WebSocket connections before signing out
 * This prevents authentication errors in subscriptions during sign-out
 */
export const cleanupAllSubscriptions = (): void => {
  try {
    // Get all active connection IDs
    const connectionIds = Object.keys(connections);
    
    if (connectionIds.length === 0) {
      console.log('No active WebSocket connections to clean up');
      return;
    }
    
    console.log(`Cleaning up ${connectionIds.length} WebSocket connections before sign-out`);
    
    // Close each connection
    connectionIds.forEach(connId => {
      try {
        const connection = connections[connId];
        if (connection && connection.readyState === WebSocket.OPEN) {
          // Send a close message if protocol supports it
          try {
            connection.send(JSON.stringify({ type: 'stop', id: '1' }));
          } catch (e) {
            // Ignore errors from sending close message
          }
          
          // Close the connection
          connection.close();
          console.log(`Closed WebSocket connection for ${connId}`);
        }
      } catch (e) {
        console.error(`Error closing WebSocket connection for ${connId}:`, e);
      } finally {
        // Make sure to delete the connection reference
        delete connections[connId];
      }
    });
    
    console.log('All WebSocket connections closed successfully');
  } catch (e) {
    console.error('Error cleaning up subscriptions:', e);
  }
};

export default {
  cleanupAllSubscriptions,
  setSigningOutState,
  isSigningOutInProgress
};

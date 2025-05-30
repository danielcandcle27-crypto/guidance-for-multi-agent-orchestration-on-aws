/**
 * Session Recovery Utilities
 * 
 * This file provides utilities to help recover from incomplete message responses
 * and ensure that chat sessions maintain proper state between message sends.
 * It includes functions to restore incomplete messages and clear stale state.
 * 
 * Enhanced with dynamic session management for better message completion handling.
 */

import { forceCompleteAllMessages } from './messageRenderingTools';
import { resetChatSession } from './killSwitch';

// Define types for message objects
interface Message {
  id: string;
  type: string;
  content: string | React.ReactNode;
  timestamp: string;
}

/**
 * Finds and returns the longest stored version of a message from localStorage
 * 
 * @param messageId The ID of the message to look for
 * @returns The longest version of the message content or null if not found
 */
export function findLongestMessageVersion(messageId: string): string | null {
  if (!messageId) return null;
  
  // Check both regular keys and product-specific backup keys
  let longestContent = '';
  let longestKey = '';
  
  // Check all localStorage keys
  Object.keys(localStorage).forEach(key => {
    // Look for keys related to this message ID
    if (key.includes(messageId) || 
        (key.startsWith('complete_message_') && localStorage.getItem(key)?.includes(messageId)) ||
        (key.startsWith('product_message_'))) {
      
      const content = localStorage.getItem(key);
      if (content && content.length > longestContent.length) {
        longestContent = content;
        longestKey = key;
      }
    }
  });
  
  if (longestContent) {
    console.log(`✓ Found longest version of message ${messageId} in key ${longestKey} (${longestContent.length} chars)`);
  }
  
  return longestContent || null;
}

/**
 * Create a backup of all messages in localStorage
 * This helps ensure message content can be recovered even if the UI state is lost
 * 
 * @returns True if backup was created, false if no messages to backup
 */
export function backupAllMessages(): boolean {
  const backupKey = `message_backup_${Date.now()}`;
  const backupData: Record<string, string> = {};
  let messageCount = 0;
  
  // Collect all message-related localStorage items
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('complete_message_') || key.startsWith('product_message_')) {
      const content = localStorage.getItem(key);
      if (content) {
        backupData[key] = content;
        messageCount++;
      }
    }
  });
  
  if (messageCount > 0) {
    // Store the backup
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    console.log(`💾 Created backup of ${messageCount} messages with key: ${backupKey}`);
    return true;
  } else {
    console.log('⚠️ No messages found to backup');
    return false;
  }
}

/**
 * Restore messages from an existing backup
 * @param backupKey The key of the backup to restore from, or the most recent if not specified
 * @returns True if messages were restored, false otherwise
 */
export function restoreFromBackup(backupKey?: string): boolean {
  // If no backup key provided, find the most recent one
  if (!backupKey) {
    const backupKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('message_backup_'))
      .sort((a, b) => {
        // Extract timestamps from keys and sort newest first
        const aTime = parseInt(a.split('_').pop() || '0');
        const bTime = parseInt(b.split('_').pop() || '0');
        return bTime - aTime; 
      });
      
    if (backupKeys.length > 0) {
      backupKey = backupKeys[0]; // Use most recent backup
    } else {
      console.log('⚠️ No message backups found');
      return false;
    }
  }
  
  // Get the backup data
  const backup = localStorage.getItem(backupKey);
  if (!backup) {
    console.log(`⚠️ No backup found with key ${backupKey}`);
    return false;
  }
  
  try {
    const backupData = JSON.parse(backup);
    let restoredCount = 0;
    
    // Restore each message
    Object.entries(backupData).forEach(([key, content]) => {
      localStorage.setItem(key, content as string);
      restoredCount++;
    });
    
    console.log(`✅ Restored ${restoredCount} messages from backup ${backupKey}`);
    return true;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    return false;
  }
}

/**
 * Attempt to recover incomplete messages in the UI
 * Scans for any message elements that might have incomplete content
 * and updates them with the complete version from localStorage
 * 
 * @param messages Array of current messages in the UI state
 * @param updateMessage Function to update a message in the UI state
 */
export function recoverIncompleteMessages(
  messages: Message[], 
  updateMessage: (id: string, content: string) => void
): void {
  console.log('🔍 Checking for incomplete messages to recover...');
  
  // First ensure all animations are stopped and content is fully rendered
  forceCompleteAllMessages();
  
  let recoveredCount = 0;
  
  // Look through each message in the state
  messages.forEach(message => {
    // Only check assistant messages (excluding greeting)
    if (message.type === 'assistant' && message.id !== '1') {
      const currentContent = typeof message.content === 'string' 
        ? message.content 
        : '';
        
      // Find the longest version in localStorage
      const completeContent = findLongestMessageVersion(message.id);
      
      if (completeContent && completeContent.length > currentContent.length + 10) {
        // If localStorage has a significantly longer version, update the UI
        console.log(`🔧 Recovering message ${message.id}: Using version that is ${completeContent.length - currentContent.length} chars longer`);
        updateMessage(message.id, completeContent);
        recoveredCount++;
      }
    }
  });
  
  // Report results
  if (recoveredCount > 0) {
    console.log(`✅ Recovered ${recoveredCount} incomplete messages`);
  } else {
    console.log('✅ No incomplete messages found that needed recovery');
  }
}

/**
 * Reset the session state and try to recover any incomplete messages
 * This is the main recovery function that should be called when problems are detected
 * 
 * @param messages Array of current messages in the UI state
 * @param updateMessage Function to update a message in the UI state
 */
export function performSessionRecovery(
  messages: Message[],
  updateMessage: (id: string, content: string) => void
): void {
  console.log('🚑 Performing emergency session recovery');
  
  // 1. Create a backup of current messages
  backupAllMessages();
  
  // 2. Reset the session state
  resetChatSession();
  
  // 3. Force complete any streaming messages
  document.dispatchEvent(new Event('stopAllTextAnimations'));
  setTimeout(() => {
    document.dispatchEvent(new Event('forceCompleteTextContent'));
  }, 100);
  
  // 4. Try to recover any incomplete messages
  setTimeout(() => {
    recoverIncompleteMessages(messages, updateMessage);
  }, 300);
}

/**
 * Enhanced session management for dynamic reset between messages
 * This function provides automatic timeout-based completion detection
 * 
 * @param sessionTimeout Timeout in milliseconds after which to force completion (default: 10 seconds)
 * @returns Function to clear the timeout if completion occurs earlier
 */
export function setupSessionTimeoutManager(sessionTimeout: number = 10000): () => void {
  console.log(`⏱️ Setting up session timeout manager with ${sessionTimeout}ms timeout`);
  
  let timeoutId: NodeJS.Timeout;
  
  const resetTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      console.log('⏰ Session timeout reached - forcing completion');
      
      // Force completion of any pending responses
      document.dispatchEvent(new Event('stopAllTextAnimations'));
      document.dispatchEvent(new Event('forceCompleteTextContent'));
      
      // Dispatch completion event for any listening components
      const timeoutEvent = new CustomEvent('sessionTimeout', {
        detail: {
          timestamp: Date.now(),
          source: 'sessionTimeoutManager'
        }
      });
      document.dispatchEvent(timeoutEvent);
      
    }, sessionTimeout);
  };
  
  // Start the initial timeout
  resetTimeout();
  
  // Listen for new message events to reset the timeout
  const handleNewMessage = () => {
    console.log('🔄 New message detected - resetting session timeout');
    resetTimeout();
  };
  
  // Listen for completion events to clear the timeout
  const handleCompletion = () => {
    console.log('✅ Message completion detected - clearing session timeout');
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
  
  // Set up event listeners
  document.addEventListener('agentTraceEvent', (e) => {
    const event = e as CustomEvent;
    if (event.detail?.type === 'question') {
      handleNewMessage();
    } else if (event.detail?.type === 'complete') {
      handleCompletion();
    }
  });
  
  document.addEventListener('finalMessageDetected', handleCompletion);
  document.addEventListener('finalMessageRendered', handleCompletion);
  
  // Return cleanup function
  return () => {
    console.log('🧹 Cleaning up session timeout manager');
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}

// Export a global accessor to aid debugging from console
if (typeof window !== 'undefined') {
  (window as any).SessionRecovery = {
    findLongestMessageVersion,
    backupAllMessages,
    restoreFromBackup,
    recoverIncompleteMessages,
    performSessionRecovery
  };
}

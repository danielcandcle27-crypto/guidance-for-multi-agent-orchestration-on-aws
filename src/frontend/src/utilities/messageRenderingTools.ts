/**
 * Message Rendering Tools
 * 
 * This file exports utilities to help debug and test message rendering issues.
 */

import { 
  isFinalResponseContent,
  parseMarkdown
} from './finalMessageStreaming';

import { MessageTester } from './messageCompletionTest';

/**
 * Check if a message contains product-related content
 */
export function containsProductContent(content: string): boolean {
  // Product-specific patterns to detect
  const productPatterns = [
    "ThunderBolt Speaker",
    "SonicWave",
    "Recommended Products:",
    "Troubleshooting Tips:"
  ];
  
  // Check if any of the patterns are in the content
  return productPatterns.some(pattern => content.includes(pattern));
}

/**
 * Force complete rendering of any active messages
 * This is useful to fix any truncated messages that might be currently displayed
 */
export function forceCompleteAllMessages(): void {
  console.log("🛑 Forcing completion of all messages");
  
  // First stop all animations
  document.dispatchEvent(new Event('stopAllTextAnimations'));
  
  // Then force complete content to be displayed
  setTimeout(() => {
    document.dispatchEvent(new Event('forceCompleteTextContent'));
    console.log("✅ All messages should now be completely displayed");
  }, 100);
}

/**
 * Backup all product-related messages in localStorage
 * This helps ensure we can recover full message content even across sessions
 */
export function backupProductMessages(prefix: string = 'product_backup_'): number {
  const backupCount = {
    saved: 0,
    total: 0
  };
  
  // Check all localStorage items
  Object.keys(localStorage).forEach(key => {
    // Look for message content
    if (key.startsWith('complete_message_')) {
      const content = localStorage.getItem(key);
      backupCount.total++;
      
      if (content && containsProductContent(content)) {
        // Create a backup with timestamp
        const backupKey = `${prefix}${Date.now()}_${key}`;
        localStorage.setItem(backupKey, content);
        backupCount.saved++;
        
        console.log(`📥 Created backup of product message: ${backupKey}`);
      }
    }
  });
  
  console.log(`📊 Backup complete: ${backupCount.saved}/${backupCount.total} messages backed up`);
  return backupCount.saved;
}

/**
 * Test message completion for a specific message
 * @param content The message content to test
 * @returns Diagnostic information about the message
 */
export function testMessageDetection(content: string): object {
  return {
    length: content.length,
    isFinalResponse: isFinalResponseContent(content),
    containsProductContent: containsProductContent(content),
    firstLine: content.split('\n')[0],
    lastLine: content.split('\n').pop(),
  };
}

// Import and re-export the message test utilities
export { testMessageCompletion } from './messageCompletionTest';

// Export diagnostic tool for verifying message completion
export const MessageDiagnostics = {
  containsProductContent,
  forceCompleteAllMessages,
  backupProductMessages,
  testMessageDetection,
  // Access to MessageTester
  ...MessageTester
};

// If this is imported directly in a browser context, expose to window
if (typeof window !== 'undefined') {
  (window as any).MessageDiagnostics = MessageDiagnostics;
}

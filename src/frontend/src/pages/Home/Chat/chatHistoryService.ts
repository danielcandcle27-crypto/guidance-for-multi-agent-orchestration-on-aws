// Local storage implementation instead of DynamoDB

export interface Message {
  id: string;
  type: string;
  content: React.ReactNode;
  timestamp: string;
}

export interface MessagePair {
  id: string;
  user: Message;
  assistant: Message;
  date: string;
  time: string;
}

// Storage keys
const CHAT_HISTORY_KEY = 'chatHistory';
const SESSION_HISTORY_PREFIX = 'session_history_';
const PRODUCT_MESSAGE_PREFIX = 'product_message_';
const COMPLETE_MESSAGE_PREFIX = 'complete_message_';

// Configuration constants
const MAX_CHAT_HISTORY_ITEMS = 10;
const MAX_SESSION_HISTORY_ITEMS = 5;
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Fetches chat history from localStorage
 * @returns An array of message pairs formatted for the UI
 */
export async function fetchChatHistoryForCurrentUser(): Promise<MessagePair[]> {
  try {
    console.log("Fetching chat history from localStorage");
    
    // Get chat history from localStorage
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!savedHistory) {
      console.log("No chat history found in localStorage");
      return [];
    }
    
    // Parse the stored JSON
    const history = JSON.parse(savedHistory);
    if (!Array.isArray(history)) {
      console.error("Invalid chat history format in localStorage");
      return [];
    }
    
    console.log(`Retrieved ${history.length} chat history items from localStorage`);
    
    return history;
  } catch (error) {
    console.error("Error fetching chat history from localStorage:", error);
    return []; // Return empty array instead of throwing to prevent UI errors
  }
}

/**
 * Clean up old backup message items from localStorage
 * @returns The number of items removed
 */
export function cleanupMessageBackups(): number {
  try {
    console.log("🧹 Cleaning up old message backups from localStorage");
    let removedCount = 0;
    
    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);
    
    // Find all product message and complete message keys
    const backupKeys = allKeys.filter(key => 
      key.startsWith(PRODUCT_MESSAGE_PREFIX) || 
      key.startsWith(COMPLETE_MESSAGE_PREFIX)
    );
    
    // Keep only the 10 most recent items for each prefix type
    const productMsgKeys = backupKeys
      .filter(key => key.startsWith(PRODUCT_MESSAGE_PREFIX))
      .sort((a, b) => {
        // Extract the timestamp part and convert to number
        const tsA = Number(a.replace(PRODUCT_MESSAGE_PREFIX, '')) || 0;
        const tsB = Number(b.replace(PRODUCT_MESSAGE_PREFIX, '')) || 0;
        return tsB - tsA; // Sort descending (newest first)
      });
      
    const completeMsgKeys = backupKeys
      .filter(key => key.startsWith(COMPLETE_MESSAGE_PREFIX))
      .sort((a, b) => {
        // Extract the timestamp or ID part
        const tsA = Number(a.replace(COMPLETE_MESSAGE_PREFIX, '')) || 0;
        const tsB = Number(b.replace(COMPLETE_MESSAGE_PREFIX, '')) || 0;
        return tsB - tsA; // Sort descending (newest first)
      });
    
    // Remove older product message backups beyond the limit
    if (productMsgKeys.length > MAX_CHAT_HISTORY_ITEMS) {
      const keysToRemove = productMsgKeys.slice(MAX_CHAT_HISTORY_ITEMS);
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        removedCount++;
      });
      console.log(`Removed ${keysToRemove.length} old product message backups`);
    }
    
    // Remove older complete message backups beyond the limit
    if (completeMsgKeys.length > MAX_CHAT_HISTORY_ITEMS * 2) { // More generous limit for completed messages
      const keysToRemove = completeMsgKeys.slice(MAX_CHAT_HISTORY_ITEMS * 2);
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        removedCount++;
      });
      console.log(`Removed ${keysToRemove.length} old complete message backups`);
    }
    
    return removedCount;
  } catch (error) {
    console.error("Error cleaning up message backups:", error);
    return 0;
  }
}

/**
 * Clean up old session history from localStorage
 * @returns The number of session histories removed
 */
export function cleanupSessionHistories(): number {
  try {
    console.log("🧹 Cleaning up old session histories from localStorage");
    let removedCount = 0;
    
    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);
    
    // Find session history keys
    const sessionKeys = allKeys.filter(key => key.startsWith(SESSION_HISTORY_PREFIX));
    
    // Sort session keys by how recent they are (if the key contains timestamp info)
    // For keys that don't have parseable timestamps, they'll be considered oldest
    const sortedSessionKeys = sessionKeys.sort((a, b) => {
      // Try to extract the timestamp part
      const tsA = Number(a.replace(SESSION_HISTORY_PREFIX, '').split('-')[0]) || 0;
      const tsB = Number(b.replace(SESSION_HISTORY_PREFIX, '').split('-')[0]) || 0;
      return tsB - tsA; // Sort descending (newest first)
    });
    
    // Keep only the most recent session histories
    if (sortedSessionKeys.length > MAX_SESSION_HISTORY_ITEMS) {
      const keysToRemove = sortedSessionKeys.slice(MAX_SESSION_HISTORY_ITEMS);
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        removedCount++;
      });
      console.log(`Removed ${keysToRemove.length} old session histories`);
    }
    
    return removedCount;
  } catch (error) {
    console.error("Error cleaning up session histories:", error);
    return 0;
  }
}

/**
 * Run all chat storage cleanup operations
 * @param forceCleanup Force cleanup even if not at quota limits
 * @returns Total number of items cleaned up
 */
export function cleanupChatStorage(forceCleanup: boolean = false): number {
  try {
    // Check if we're approaching storage quotas
    let totalRemoved = 0;
    
    // Estimate current localStorage usage
    const storageEstimate = getLocalStorageSize();
    const storageLimit = 5 * 1024 * 1024; // Assume 5MB limit (conservative)
    const usageRatio = storageEstimate / storageLimit;
    
    console.log(`📊 Current localStorage usage: ~${Math.round(storageEstimate/1024)}KB (${Math.round(usageRatio*100)}% of limit)`);
    
    // Only do cleanup if we're approaching limits or forced
    if (usageRatio > 0.7 || forceCleanup) {
      console.log(`🧹 Running chat storage cleanup (${forceCleanup ? 'forced' : 'automatic'})`);
      
      // Run cleanup functions
      totalRemoved += cleanupMessageBackups();
      totalRemoved += cleanupSessionHistories();
      
      console.log(`✅ Chat storage cleanup complete: removed ${totalRemoved} items`);
    }
    
    return totalRemoved;
  } catch (error) {
    console.error("Error during chat storage cleanup:", error);
    return 0;
  }
}

/**
 * Clear all chat-related storage items from localStorage
 * WARNING: This will delete all chat history and message backups
 */
export function clearAllChatStorage(): void {
  try {
    console.log("🗑️ Clearing all chat-related storage from localStorage");
    
    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);
    
    // Find all chat-related keys
    const chatKeys = allKeys.filter(key => 
      key === CHAT_HISTORY_KEY ||
      key.startsWith(SESSION_HISTORY_PREFIX) ||
      key.startsWith(PRODUCT_MESSAGE_PREFIX) ||
      key.startsWith(COMPLETE_MESSAGE_PREFIX)
    );
    
    // Remove all chat-related items
    chatKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`✅ Cleared ${chatKeys.length} chat-related items from localStorage`);
  } catch (error) {
    console.error("Error clearing chat storage:", error);
  }
}

/**
 * Utility function to estimate localStorage size in bytes
 * @returns Estimated size in bytes
 */
function getLocalStorageSize(): number {
  try {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const value = localStorage.getItem(key) || '';
      totalSize += key.length + value.length;
    }
    // Account for encoding overhead (rough estimate)
    return totalSize * 2;
  } catch (error) {
    console.error("Error calculating localStorage size:", error);
    return 0;
  }
}

/**
 * Save a message pair to localStorage chat history
 * @param messagePair The message pair to save
 */
export function saveMessagePair(messagePair: MessagePair): void {
  try {
    // Get existing history
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    let history: MessagePair[] = [];
    
    if (savedHistory) {
      history = JSON.parse(savedHistory);
      
      // Make sure it's an array
      if (!Array.isArray(history)) {
        history = [];
      }
    }
    
    // Add new message pair
    history.push(messagePair);
    
    // Keep only the most recent 10 conversations
    if (history.length > MAX_CHAT_HISTORY_ITEMS) {
      history = history.slice(-MAX_CHAT_HISTORY_ITEMS);
    }
    
    // Try to save to localStorage
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
      console.log(`Saved message pair to localStorage chat history. Total: ${history.length}`);
    } catch (storageError) {
      // If we get a quota error, run cleanup and try again
      if (storageError.name === 'QuotaExceededError' || 
          String(storageError).includes('exceeded the quota')) {
        console.warn('Storage quota exceeded, running cleanup and retrying');
        
        // Run emergency cleanup
        const cleanedItems = cleanupChatStorage(true);
        console.log(`Emergency cleanup removed ${cleanedItems} items`);
        
        // If we cleaned up items, try saving again
        if (cleanedItems > 0) {
          try {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
            console.log('Successfully saved message after cleanup');
          } catch (retryError) {
            // If it still fails, save a reduced history
            console.error('Still failed after cleanup, saving reduced history', retryError);
            // Keep only the 3 most recent
            const reducedHistory = history.slice(-3);
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(reducedHistory));
          }
        } else {
          // Last resort: clear everything and try with just this message pair
          clearAllChatStorage();
          localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify([messagePair]));
          console.log('All chat storage cleared, saved only current message pair');
        }
      } else {
        // If it's not a quota error, just log it
        console.error("Error saving message pair to localStorage:", storageError);
      }
    }
    
    // Run preventive cleanup every 3rd save operation (throttled)
    if (Math.random() < 0.33) {
      setTimeout(() => {
        cleanupChatStorage(false);
      }, 100);
    }
  } catch (error) {
    console.error("Error saving message pair to localStorage:", error);
  }
}

/**
 * Fetches chat history by session ID from localStorage
 * @param sessionId The session ID to fetch history for
 * @returns An array of message pairs for that session
 */
export async function fetchChatHistoryBySessionId(sessionId: string): Promise<MessagePair[]> {
  try {
    if (!sessionId) {
      throw new Error("Session ID is required");
    }
    
    console.log(`Fetching chat history for session ${sessionId} from localStorage`);
    
    // Get session-specific history from localStorage
    const sessionKey = `${SESSION_HISTORY_PREFIX}${sessionId}`;
    const savedHistory = localStorage.getItem(sessionKey);
    
    if (!savedHistory) {
      console.log(`No chat history found for session ${sessionId} in localStorage`);
      return [];
    }
    
    // Parse the stored JSON
    const history = JSON.parse(savedHistory);
    if (!Array.isArray(history)) {
      console.error(`Invalid chat history format for session ${sessionId} in localStorage`);
      return [];
    }
    
    console.log(`Retrieved ${history.length} chat history items for session ${sessionId}`);
    
    return history;
  } catch (error) {
    console.error(`Error fetching chat history for session ${sessionId} from localStorage:`, error);
    return []; // Return empty array instead of throwing to prevent UI errors
  }
}

/**
 * Save a message pair to localStorage for a specific session
 * @param sessionId The session ID to save for
 * @param messagePair The message pair to save
 */
export function saveSessionMessagePair(sessionId: string, messagePair: MessagePair): void {
  try {
    if (!sessionId) {
      throw new Error("Session ID is required");
    }
    
    // Get session-specific history
    const sessionKey = `${SESSION_HISTORY_PREFIX}${sessionId}`;
    const savedHistory = localStorage.getItem(sessionKey);
    let history: MessagePair[] = [];
    
    if (savedHistory) {
      history = JSON.parse(savedHistory);
      
      // Make sure it's an array
      if (!Array.isArray(history)) {
        history = [];
      }
    }
    
    // Add new message pair
    history.push(messagePair);
    
    // Keep only the most recent conversations for session history
    if (history.length > MAX_SESSION_HISTORY_ITEMS * 2) {
      history = history.slice(-MAX_SESSION_HISTORY_ITEMS * 2);
    }
    
    // Try to save to localStorage
    try {
      localStorage.setItem(sessionKey, JSON.stringify(history));
      console.log(`Saved message pair to localStorage for session ${sessionId}`);
    } catch (storageError) {
      // If we get a quota error, run cleanup and try again
      if (storageError.name === 'QuotaExceededError' || 
          String(storageError).includes('exceeded the quota')) {
        console.warn(`Storage quota exceeded when saving session ${sessionId}, running cleanup`);
        
        // Run emergency cleanup
        const cleanedItems = cleanupChatStorage(true);
        console.log(`Emergency cleanup removed ${cleanedItems} items`);
        
        // If we cleaned up items, try saving again
        if (cleanedItems > 0) {
          try {
            localStorage.setItem(sessionKey, JSON.stringify(history));
            console.log('Successfully saved session message after cleanup');
          } catch (retryError) {
            // If it still fails, save a reduced history
            console.error('Still failed after cleanup, saving reduced session history', retryError);
            // Keep only the most recent
            const reducedHistory = history.slice(-2);
            localStorage.setItem(sessionKey, JSON.stringify(reducedHistory));
          }
        } else {
          // Last resort: save just this message pair
          localStorage.setItem(sessionKey, JSON.stringify([messagePair]));
          console.log('Session history reduced to current message pair only');
        }
      } else {
        // If it's not a quota error, just log it
        console.error(`Error saving message pair for session ${sessionId} to localStorage:`, storageError);
      }
    }
    
    // Also save to the main chat history - this will trigger its own cleanup if needed
    try {
      saveMessagePair(messagePair);
    } catch (mainSaveError) {
      console.error('Failed to save to main chat history:', mainSaveError);
    }
  } catch (error) {
    console.error(`Error saving message pair for session ${sessionId} to localStorage:`, error);
  }
}

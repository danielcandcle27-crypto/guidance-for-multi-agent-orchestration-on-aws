// Helper module to load chat history with explicit console logging
import { fetchChatHistoryForCurrentUser } from './chatHistoryService';

/**
 * Loads chat history data from localStorage and logs it to console
 * Returns the history data for UI display
 */
export async function loadAndLogChatHistory() {
  try {
    console.log('📊 Fetching chat history from localStorage...');
    const historyData = await fetchChatHistoryForCurrentUser();
    
    // Log detailed information about the chat history
    console.log('🔍 localStorage Chat History Data:', historyData);
    
    if (historyData.length > 0) {
      console.table(historyData.map(pair => ({
        date: pair.date,
        time: pair.time,
        user_message: typeof pair.user.content === 'string' ? 
          pair.user.content.substring(0, 30) + '...' : 'Complex content',
        assistant_message: typeof pair.assistant.content === 'string' ? 
          pair.assistant.content.substring(0, 30) + '...' : 'Complex content'
      })));
    } else {
      console.warn('⚠️ No chat history records found in localStorage');
    }
    
    return historyData;
  } catch (error) {
    console.error('❌ Error loading chat history from localStorage:', error);
    throw error;
  }
}

/**
 * Direct method to load chat history from localStorage
 * Ensures only the last 10 messages are returned
 */
export function loadChatHistoryFromLocalStorage() {
  try {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      const parsedHistory = JSON.parse(savedHistory);
      if (Array.isArray(parsedHistory)) {
        // Ensure we only return the last 10 items
        const historyItems = parsedHistory.slice(-10);
        console.log('📋 Falling back to localStorage for chat history:', historyItems.length, 'items');
        return historyItems;
      }
    }
    
    return [];
  } catch (e) {
    console.error('Error parsing chat history from localStorage:', e);
    return [];
  }
}

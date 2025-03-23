import { atom } from "jotai";

export interface ChatHistoryEntry {
  prompt: string;
  response: string;
  timestamp: number;
  entryNumber?: number;  // Sequential number for the entry
}

// Function to load chat history from localStorage
export const loadChatHistory = (): ChatHistoryEntry[] => {
  const historyStr = localStorage.getItem('chat_history');
  console.log('Debug - Loading history from storage:', historyStr);
  
  if (!historyStr) {
    console.log('Debug - No history found in storage');
    return [];
  }

  try {
      const parsedHistory = JSON.parse(historyStr);
      console.log('Debug - Successfully parsed history:', parsedHistory);
      // Validate and clean the history entries
      const validatedHistory = parsedHistory.map((entry: any) => ({
        prompt: typeof entry.prompt === 'string' ? entry.prompt.trim() : '',
        response: typeof entry.response === 'string' ? entry.response.trim() : '',
        timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
        entryNumber: typeof entry.entryNumber === 'number' ? entry.entryNumber : undefined
      }));
      // Limit to most recent 10 entries
      return validatedHistory.slice(-10);
  } catch (e) {
    console.error('Debug - Failed to parse history:', e);
    return [];
  }
};

// Initialize atom with data from localStorage
export const chatHistoryAtom = atom<ChatHistoryEntry[]>(loadChatHistory());

// Atom to control history panel visibility
export const showHistoryPanelAtom = atom<boolean>(false);

// Function to add a new entry to chat history
export const addToChatHistory = (prompt: string, response: string) => {
  // Validate and clean input strings
  console.log('Debug - addToChatHistory called with:', { prompt, response });
  
  // Get current history to determine next entry number
  const currentHistory = loadChatHistory();
  const nextEntryNumber = currentHistory.length > 0 
    ? Math.max(...currentHistory.map(entry => entry.entryNumber || 0)) + 1
    : 1;
  
  if (typeof prompt !== 'string' || !prompt.trim()) {
    console.error('Invalid prompt:', { prompt, type: typeof prompt });
    return [];
  }
  
  // Create new entry with sequential number
  const newEntry: ChatHistoryEntry = {
    prompt: prompt.trim(),
    response: response.trim(),
    timestamp: Date.now(),
    entryNumber: nextEntryNumber
  };

  if (typeof response !== 'string' || !response.trim()) {
    console.error('Invalid response:', { response, type: typeof response });
    return [];
  }

  // Clean input values
  const trimmedPrompt = prompt.trim();
  const trimmedResponse = response.trim();

  console.log('Debug - Processing input in addToChatHistory:', {
    trimmedPrompt,
    trimmedResponse
  });

  if (!trimmedPrompt || !trimmedResponse) {
    console.warn('Debug - Invalid input after trim:', { 
      trimmedPrompt, 
      trimmedResponse 
    });
    return [];
  }

  // Get existing history
  const historyStr = localStorage.getItem('chat_history');
  console.log('Debug - Loading existing history from storage:', historyStr);
  
  // Parse existing history with fallback to empty array
  let existingHistory = [];
  try {
    existingHistory = historyStr ? JSON.parse(historyStr) : [];
    if (!Array.isArray(existingHistory)) {
      console.warn('Debug - History is not an array, resetting');
      existingHistory = [];
    }
  } catch (e) {
    console.error('Debug - Failed to parse history:', e);
  }
  
  // Update the existing newEntry with validated values
  console.log('Debug - Updating existing entry with validated values');
  newEntry.prompt = trimmedPrompt;      // Use validated value
  newEntry.response = trimmedResponse;  // Use trimmed value
  newEntry.timestamp = Date.now();

  // Log the entry first
  console.log('Debug - New entry created:', {
    entry: newEntry,
    promptType: typeof newEntry.prompt,
    promptLength: newEntry.prompt.length
  });

  // Create updated history array and save
  let newHistory: ChatHistoryEntry[] = [...existingHistory, newEntry].slice(-10);  // Keep only latest 10 entries
  try {
    localStorage.setItem('chat_history', JSON.stringify(newHistory));
    console.log('Debug - Saved history:', newHistory);
    return newHistory;
  } catch (error) {
    console.error('Failed to save history:', error);
    return [];
  }
  
  console.log('Debug - New entry created:', {
    entry: newEntry,
    promptType: typeof newEntry.prompt,
    promptLength: newEntry.prompt.length,
    hasTimestamp: Boolean(newEntry.timestamp)
  });
  
  // Ensure entry is unique and sort by timestamp
  const existingEntry = existingHistory.find(entry => 
    entry.prompt === newEntry.prompt && 
    entry.response === newEntry.response
  );

  // Clean up and validate all entries
  const cleanedHistory = existingHistory
    .filter(entry => entry && typeof entry.prompt === 'string' && entry.prompt.trim())
    .map(entry => ({
      ...entry,
      prompt: entry.prompt.trim(),
      response: entry.response.trim()
    }));

  // Check for duplicate by exact match only
  const exactDuplicate = cleanedHistory
    .some(entry => entry.prompt === newEntry.prompt && entry.response === newEntry.response);
    
  newHistory = exactDuplicate 
    ? cleanedHistory 
    : [newEntry, ...cleanedHistory].slice(0, 10);  // Keep last 10 entries

  // Verify new entry is in the history
  if (!existingEntry && !newHistory.some(entry => entry.prompt === newEntry.prompt)) {
    console.log('Debug - Adding entry was unsuccessful, retrying');
    newHistory = [newEntry, ...existingHistory].slice(0, 10);
  }  // Keep last 10 entries

  console.log('Debug - Validating history before save:', newHistory.map(entry => ({
    hasPrompt: Boolean(entry.prompt),
    promptType: typeof entry.prompt,
    promptLength: entry.prompt?.length,
    timestamp: entry.timestamp
  })));

  const historyToSave = JSON.stringify(newHistory);
  console.log('Debug - About to save history string:', historyToSave);
  
  localStorage.setItem('chat_history', historyToSave);
  
  // Verify the save worked
  const savedHistory = loadChatHistory();
  console.log('Debug - Verified saved history:', {
    saved: savedHistory,
    matches: JSON.stringify(savedHistory) === historyToSave
  });
  
  console.log('Debug - Updated history:', newHistory);
  return newHistory;
};


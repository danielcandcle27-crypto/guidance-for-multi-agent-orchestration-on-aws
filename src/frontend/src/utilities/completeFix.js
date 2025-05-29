/**
 * Message Completion Fix Utility
 * 
 * This utility script can be run from the browser console to force completion
 * of any cut-off messages. It addresses issues with message rendering and
 * ensures chat history shows complete content.
 */

// Function to force complete all messages in the chat UI
function forceCompleteAllMessages() {
  console.log('🔍 Checking for incomplete messages...');
  
  // Force all streaming to complete
  document.dispatchEvent(new Event('stopAllTextAnimations'));
  
  // Then force complete content to be displayed
  setTimeout(() => {
    document.dispatchEvent(new Event('forceCompleteTextContent'));
    console.log('✅ Message completion forced on all active messages');

    // Find any partial messages in the DOM
    const bubbles = document.querySelectorAll('.cloudscape-chat-bubble-content');
    console.log(`Found ${bubbles.length} chat bubbles to inspect`);
    
    // Create a backup of the localStorage messages
    backupAllMessages();
  }, 100);
}

// Find the longest version of a message in localStorage
function findLongestMessageVersion(messageId) {
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

// Create a backup of all messages in localStorage
function backupAllMessages() {
  const backupKey = `message_backup_${Date.now()}`;
  const backupData = {};
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

// Function to restore the longest version of a message to the DOM
function restoreMessageContent(messageId) {
  // Find the longest version of this message
  const completeContent = findLongestMessageVersion(messageId);
  
  if (!completeContent) {
    console.log(`⚠️ No stored content found for message ${messageId}`);
    return false;
  }
  
  // Try to find the corresponding message in the DOM
  const messageElements = Array.from(document.querySelectorAll('.cloudscape-chat-bubble-content'));
  
  // Look through each bubble's content for partial matches of our complete content
  let matchedElement = null;
  let bestMatchLength = 0;
  
  messageElements.forEach(element => {
    const elementContent = element.textContent || '';
    
    // Check if this element contains a significant portion of our complete content
    // or if our complete content contains this element's content
    if ((completeContent.includes(elementContent) && elementContent.length > 50) || 
        (elementContent.includes(completeContent.substring(0, 50)) && completeContent.substring(0, 50).length > 0)) {
      
      // Use the longest match as our best candidate
      if (elementContent.length > bestMatchLength) {
        matchedElement = element;
        bestMatchLength = elementContent.length;
      }
    }
  });
  
  if (matchedElement) {
    // We found a matching element, update its content
    console.log(`🔄 Updating message element with complete content (${completeContent.length} chars)`);
    
    // Create a new div with the complete content
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = completeContent;
    contentDiv.className = 'restored-content';
    
    // Replace the original content
    matchedElement.innerHTML = '';
    matchedElement.appendChild(contentDiv);
    
    return true;
  }
  
  console.log('⚠️ Could not find a matching DOM element for this message');
  return false;
}

// Function to restore all messages from a backup
function restoreFromBackup(backupKey) {
  const backup = localStorage.getItem(backupKey);
  if (!backup) {
    console.log(`⚠️ No backup found with key ${backupKey}`);
    return false;
  }
  
  try {
    const backupData = JSON.parse(backup);
    let restoredCount = 0;
    
    // Restore each message
    Object.keys(backupData).forEach(key => {
      localStorage.setItem(key, backupData[key]);
      restoredCount++;
    });
    
    console.log(`✅ Restored ${restoredCount} messages from backup`);
    return true;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    return false;
  }
}

// Export all functions
window.ChatMessageFixer = {
  forceCompleteAllMessages,
  findLongestMessageVersion,
  backupAllMessages,
  restoreMessageContent,
  restoreFromBackup,
  
  // Helper to list all message backups
  listBackups: () => {
    const backups = Object.keys(localStorage).filter(key => key.startsWith('message_backup_'));
    console.table(backups.map(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        return {
          key,
          date: new Date(parseInt(key.split('_').pop())).toLocaleString(),
          messageCount: Object.keys(data).length
        };
      } catch (e) {
        return { key, error: 'Invalid backup data' };
      }
    }));
    return backups;
  }
};

// Auto-execute to fix the current page
console.log('💊 Chat Message Fix Utility loaded');
console.log('Run ChatMessageFixer.forceCompleteAllMessages() to fix current messages');

// Automatically run the fix if this script is loaded from the diagnostic page
if (window.location.href.includes('message-completion-test.html')) {
  forceCompleteAllMessages();
}

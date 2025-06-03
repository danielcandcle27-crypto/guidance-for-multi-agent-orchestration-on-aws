/**
 * Local Storage Cleanup Utility
 * 
 * This utility provides functions to help manage localStorage usage and prevent
 * QuotaExceededError by cleaning up message-related items before storing new ones.
 */
import { cleanupLocalStorageMessages } from './finalMessageStreaming';

/**
 * Dispatch an event to trigger localStorage cleanup before sending a message
 * Call this function whenever a new message is about to be sent
 */
export const triggerMessageCleanup = (): void => {
  console.log('🧹 Triggering localStorage cleanup for new message submission');
  
  // 1. First directly call the cleanup to ensure immediate effect
  const cleanedItems = cleanupLocalStorageMessages();
  console.log(`Cleaned ${cleanedItems} localStorage items directly`);
  
  // 2. Dispatch event for any components that need to respond to message submission
  const cleanupEvent = new CustomEvent('newMessageSubmission', {
    detail: { 
      timestamp: Date.now(),
    }
  });
  document.dispatchEvent(cleanupEvent);
};

/**
 * Set up a MutationObserver to watch for new input elements and attach event handlers
 * This ensures localStorage is cleaned up when the user submits messages via the UI
 */
export const setupAutomaticCleanup = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  // Clean up localStorage immediately when the page loads
  cleanupLocalStorageMessages();
  
  // Set up handler for form submission events
  const handleFormSubmission = (event: Event) => {
    if ((event.target as HTMLElement).tagName === 'FORM') {
      triggerMessageCleanup();
    }
  };
  
  // Watch for clicks on elements that might be submit buttons
  const handlePotentialSubmitClick = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    
    const isSubmitButton = 
      // Check if it's a button with type="submit"
      (target.tagName === 'BUTTON' && (target as HTMLButtonElement).type === 'submit') ||
      // Check common button classes/IDs that might be used for submission
      target.classList.contains('send-button') ||
      target.classList.contains('submit-button') ||
      target.id === 'send-message' ||
      // Check for elements with submit-related text content
      (target.textContent && 
       ['send', 'submit', 'ask', 'search'].some(text => 
          target.textContent.toLowerCase().includes(text)));
    
    if (isSubmitButton) {
      triggerMessageCleanup();
    }
  };
  
  // Add event listeners to catch form submissions and button clicks
  document.addEventListener('submit', handleFormSubmission, true);
  document.addEventListener('click', handlePotentialSubmitClick, true);
  
  console.log('🧹 Automatic localStorage cleanup setup complete');
};

// Auto-setup when imported
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure this runs after the DOM is loaded
  setTimeout(setupAutomaticCleanup, 0);
}

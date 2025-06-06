/**
 * Kill Switch Utility
 * 
 * This utility provides functions to manage the global kill switch system
 * that stops ongoing processes when a final message is detected, while
 * preserving trace data for agent node popup windows.
 * 
 * Enhanced with flow animation freeze functionality to stop React Flow node animations
 * while preserving the trace data for popups.
 */

// Global variables to track animation states without extending window
let animationProtectionEnabled = false;
let flowAnimationsFrozen = false;

// Initialize tracking of active timers and intervals
if (typeof window !== 'undefined') {
  window.__activeTimers = window.__activeTimers || [];
  window.__activeIntervals = window.__activeIntervals || [];
  window.__processingComplete = window.__processingComplete || false;
}

// Helper to safely set animation protection
export const setAnimationProtection = (enabled: boolean): void => {
  animationProtectionEnabled = enabled;
  console.log(`${enabled ? '🔒' : '🔓'} Animation protection ${enabled ? 'enabled' : 'disabled'}`);
};

// Helper to check if animation protection is active
export const isAnimationProtected = (): boolean => {
  return animationProtectionEnabled;
};

/**
 * Freeze or unfreeze all React Flow node animations
 * This stops the animations but preserves the node data and state
 * @param frozen Whether to freeze (true) or unfreeze (false) animations
 */
export const setFlowAnimationsFrozen = (frozen: boolean): void => {
  flowAnimationsFrozen = frozen;
  console.log(`${frozen ? '❄️' : '🔥'} Flow animations ${frozen ? 'frozen' : 'unfrozen'}`);
  
  // Dispatch an event to notify all nodes of the animation state change
  const freezeEvent = new CustomEvent('flowAnimationsStateChanged', {
    detail: { 
      frozen,
      timestamp: Date.now()
    }
  });
  document.dispatchEvent(freezeEvent);
};

/**
 * Check if flow animations are currently frozen
 * @returns Boolean indicating if animations are frozen
 */
export const areFlowAnimationsFrozen = (): boolean => {
  return flowAnimationsFrozen;
};

/**
 * Toggle the frozen state of flow animations
 * @returns The new frozen state (true = frozen, false = normal)
 */
export const toggleFlowAnimations = (): boolean => {
  const newState = !flowAnimationsFrozen;
  setFlowAnimationsFrozen(newState);
  return newState;
};

/**
 * Track a timer ID for potential cleanup
 * @param timerId The ID of the timer to track
 */
export const trackTimer = (timerId: NodeJS.Timeout): void => {
  if (typeof window !== 'undefined') {
    window.__activeTimers = window.__activeTimers || [];
    window.__activeTimers.push(timerId);
  }
};

/**
 * Track an interval ID for potential cleanup
 * @param intervalId The ID of the interval to track
 */
export const trackInterval = (intervalId: NodeJS.Timeout): void => {
  if (typeof window !== 'undefined') {
    window.__activeIntervals = window.__activeIntervals || [];
    window.__activeIntervals.push(intervalId);
  }
};

/**
 * Setup the global kill switch mechanism to stop all ongoing processes
 * when a final message is detected, while preserving trace data.
 */
export const setupGlobalKillSwitch = (): void => {
  // Only set up once
  if (typeof window !== 'undefined' && !window.__hasSetupGlobalDeadSwitch) {
    // Implement the kill all processing function
    window.__killAllProcessing = () => {
      console.log('🚨 Executing global kill switch for all processing');
      
      // Mark processing as complete
      window.__processingComplete = true;
      
      // CRITICAL FIX: Clear the agent-trace-cache in localStorage to prevent reprocessing loops
      try {
        localStorage.removeItem('agent-trace-cache');
        console.log('🧹 Cleared agent trace cache from localStorage');
      } catch (e) {
        console.error('Error clearing trace cache:', e);
      }
      
      // Also freeze all flow animations when kill switch is activated
      if (!flowAnimationsFrozen) {
        setFlowAnimationsFrozen(true);
      }
      
      // Clear all active timers
      if (window.__activeTimers && Array.isArray(window.__activeTimers)) {
        window.__activeTimers.forEach((timerId) => {
          try {
            clearTimeout(timerId);
          } catch (e) {
            console.error('Error clearing timeout:', e);
          }
        });
        window.__activeTimers = [];
      }
      
      // Clear all active intervals
      if (window.__activeIntervals && Array.isArray(window.__activeIntervals)) {
        window.__activeIntervals.forEach((intervalId) => {
          try {
            clearInterval(intervalId);
          } catch (e) {
            console.error('Error clearing interval:', e);
          }
        });
        window.__activeIntervals = [];
      }
      
      // Dispatch an event that can be caught by other components
      const killEvent = new CustomEvent('globalProcessingKilled', {
        detail: { 
          timestamp: Date.now(),
        }
      });
      document.dispatchEvent(killEvent);
    };
    
    // Listen for phase 1 message event - detected final response but keep trace data
    document.addEventListener('finalMessageDetected', (e: Event) => {
      const event = e as CustomEvent;
      // Add more detailed logging
      console.log('🚨 Final message detected event received:', event.detail?.content?.substring(0, 30) + '...');
      
      if (event.detail && event.detail.preserveTraceData) {
        console.log('🚨 Final message detected - Phase 1 preservation mode active');
        // Note: We don't kill all processing yet to allow trace data to be accessed
        
        // Dispatch an animation stop event to ensure all animations complete
        document.dispatchEvent(new Event('stopAllTextAnimations'));
        
        // Clear any unnecessary timers (but not intervals that might be related to UI)
        if (window.__activeTimers && Array.isArray(window.__activeTimers)) {
          console.log(`Clearing ${window.__activeTimers.length} active timers in preservation mode`);
          window.__activeTimers.forEach((timerId) => {
            try {
              clearTimeout(timerId);
            } catch (e) {
              console.error('Error clearing timeout in preservation mode:', e);
            }
          });
          window.__activeTimers = [];
        }
      } else {
        // If preservation flag is not set, kill all processing immediately
        console.log('🚨 Final message detected without preservation flag - killing all processing');
        if (window.__killAllProcessing) {
          window.__killAllProcessing();
        }
      }
    });
    
    // Listen for phase 2 message event - final kill switch after trace data preserved
    document.addEventListener('finalMessageRendered', (e: Event) => {
      const event = e as CustomEvent;
      console.log('🚨 Final message rendered - Phase 2 complete kill switch activated', 
                 event.detail ? `(content: ${event.detail.content?.substring(0, 30)}...)` : '');
      
      // First ensure all animations are stopped
      document.dispatchEvent(new Event('stopAllTextAnimations'));
      
      // Small delay before killing all processing to ensure animations complete
      setTimeout(() => {
        // Now we can safely kill all processing as trace data should be preserved
        if (window.__killAllProcessing) {
          console.log('🔪 Executing global kill processing function');
          window.__killAllProcessing();
        }
      }, 100); // Short delay to ensure UI updates complete
    });
    
    // Additional listener for forcing animation completion
    document.addEventListener('stopAllTextAnimations', () => {
      console.log('🛑 Stop all text animations event triggered');
    });
    
    // Mark as set up
    window.__hasSetupGlobalDeadSwitch = true;
  }
};

/**
 * Check if processing is already completed
 * @returns True if processing is completed (kill switch activated)
 */
export const isProcessingComplete = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.__processingComplete === true;
  }
  return false;
};

/**
 * Reset the processing state flag to allow new messages to be processed
 * Call this when a new message is being submitted to reset the input state
 */
export const resetProcessingState = (): void => {
  if (typeof window !== 'undefined') {
    console.log('🔄 Resetting processing state to allow new messages');
    window.__processingComplete = false;
    
    // Dispatch an event that can be caught by components to re-enable inputs
    const resetEvent = new CustomEvent('processingStateReset', {
      detail: { 
        timestamp: Date.now(),
      }
    });
    document.dispatchEvent(resetEvent);
  }
};

/**
 * Comprehensive session reset function that coordinates all necessary resets
 * between chat messages. This should be called at the beginning of each new
 * message submission to ensure a clean state for the new conversation.
 * 
 * This function:
 * 1. Creates backups of existing messages for potential recovery
 * 2. Resets the processing state
 * 3. Clears all active timers and intervals
 * 4. Unfreezes flow animations
 * 5. Cleans up localStorage message caches
 * 6. Dispatches a centralized reset event
 */
export const resetChatSession = (): void => {
  if (typeof window === 'undefined') return;

  console.log('🔄 Resetting chat session state for new message');
  
  // Import the cleanup function dynamically to avoid circular dependencies
  // This is needed because finalMessageStreaming imports from killSwitch
  try {
    const { cleanupLocalStorageMessages } = require('./finalMessageStreaming');
    if (cleanupLocalStorageMessages && typeof cleanupLocalStorageMessages === 'function') {
      console.log('🧹 Running localStorage cleanup as part of session reset');
      cleanupLocalStorageMessages();
    }
  } catch (e) {
    console.error('Failed to clean up localStorage during session reset:', e);
  }
  
  // 0. First backup any important messages before clearing
  // This creates a timestamped backup of all messages for potential recovery
  try {
    // Create a backup of all current messages first
    const backupKey = `message_backup_${Date.now()}`;
    const backupData: Record<string, string> = {};
    let backupCount = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('complete_message_') || key.startsWith('product_message_'))) {
        const value = localStorage.getItem(key);
        if (value) {
          backupData[key] = value;
          backupCount++;
        }
      }
    }
    
    // Only create backup if we have messages to back up
    if (backupCount > 0) {
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      console.log(`💾 Created backup of ${backupCount} messages with key: ${backupKey}`);
    }
  } catch (e) {
    console.error('Error creating message backup during session reset:', e);
  }
  
  // 1. Reset processing complete flag
  window.__processingComplete = false;
  
  // 2. Clear all active timers
  if (window.__activeTimers && Array.isArray(window.__activeTimers)) {
    const timerCount = window.__activeTimers.length;
    window.__activeTimers.forEach((timerId) => {
      try {
        clearTimeout(timerId);
      } catch (e) {
        console.error('Error clearing timeout during session reset:', e);
      }
    });
    window.__activeTimers = [];
    console.log(`🧹 Cleared ${timerCount} active timers`);
  }
  
  // 3. Clear all active intervals
  if (window.__activeIntervals && Array.isArray(window.__activeIntervals)) {
    const intervalCount = window.__activeIntervals.length;
    window.__activeIntervals.forEach((intervalId) => {
      try {
        clearInterval(intervalId);
      } catch (e) {
        console.error('Error clearing interval during session reset:', e);
      }
    });
    window.__activeIntervals = [];
    console.log(`🧹 Cleared ${intervalCount} active intervals`);
  }
  
  // 4. Reset animation states
  setAnimationProtection(false);
  setFlowAnimationsFrozen(false);
  
  // 5. Process visible messages before clearing localStorage
  // Find any visible message elements and check if they need to be recovered
  try {
    const visibleBubbles = document.querySelectorAll('.cloudscape-chat-bubble-content');
    visibleBubbles.forEach(bubble => {
      const bubbleText = bubble.textContent || '';
      if (bubbleText.length > 0) {
        // See if this is a product-related message that we should preserve
        if (bubbleText.includes('ThunderBolt Speaker') || 
            bubbleText.includes('SonicWave') ||
            bubbleText.includes('Recommended Products:') ||
            bubbleText.includes('Troubleshooting Tips:') ||
            bubbleText.includes('VitaFit Smartwatch')) {
            
          // For product messages, create a backup with different key to ensure it survives
          const productKey = `product_backup_${Date.now()}`;
          localStorage.setItem(productKey, bubbleText);
          console.log(`📋 Created special product backup for visible message: ${productKey}`);
        }
      }
    });
  } catch (e) {
    console.error('Error processing visible messages during session reset:', e);
  }
  
  // 6. Clear localStorage message caches to prevent conflicts with new session
  // Find and clear any complete message entries but not backups
  const messagesToClear = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('complete_message_'))) {
      messagesToClear.push(key);
    }
  }
  
  messagesToClear.forEach(key => {
    localStorage.removeItem(key);
  });
  console.log(`🧹 Cleared ${messagesToClear.length} cached messages from localStorage`);
  
  // 7. Dispatch a comprehensive reset event
  const resetEvent = new CustomEvent('chatSessionReset', {
    detail: { 
      timestamp: Date.now(),
      source: 'killSwitch',
    }
  });
  document.dispatchEvent(resetEvent);
  
  // 8. Stop any ongoing text animations
  document.dispatchEvent(new Event('stopAllTextAnimations'));
  
  // 9. Emit a browser trace update to reset agent nodes
  const resetTraceEvent = new CustomEvent('agentTraceEvent', {
    detail: { 
      type: 'reset',
      connectionId: `session-${Date.now()}`,
      timestamp: Date.now(),
      content: { message: 'Session reset' }
    }
  });
  document.dispatchEvent(resetTraceEvent);
  
  console.log('✅ Chat session reset complete');
};

/**
 * Safe wrapper for setTimeout that automatically tracks timers
 * for potential cleanup by kill switch
 */
export const safeSetTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
  // If processing is already complete, don't create new timers
  if (isProcessingComplete()) {
    console.log('Prevented new timer creation - processing already complete');
    return setTimeout(() => {}, 0); // Dummy timer
  }
  
  const timerId = setTimeout(() => {
    // If the timer was allowed to complete, remove from tracking
    if (typeof window !== 'undefined' && window.__activeTimers) {
      const index = window.__activeTimers.indexOf(timerId);
      if (index !== -1) {
        window.__activeTimers.splice(index, 1);
      }
    }
    
    // Execute the callback
    callback();
  }, delay);
  
  // Track this timer for potential cleanup
  trackTimer(timerId);
  
  return timerId;
};

/**
 * Safe wrapper for setInterval that automatically tracks intervals
 * for potential cleanup by kill switch
 */
export const safeSetInterval = (callback: () => void, delay: number): NodeJS.Timeout => {
  // If processing is already complete, don't create new intervals
  if (isProcessingComplete()) {
    console.log('Prevented new interval creation - processing already complete');
    return setInterval(() => {}, 60000); // Dummy interval with long delay
  }
  
  const intervalId = setInterval(callback, delay);
  
  // Track this interval for potential cleanup
  trackInterval(intervalId);
  
  return intervalId;
};

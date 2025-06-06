/**
 * Final Message Kill Switch System
 * 
 * This file implements a two-phase kill switch for stopping ongoing processes
 * when the final message is detected in a chat response, while preserving trace data
 * in agent node popup windows.
 * 
 * Enhanced with session reset coordination to ensure clean state between messages.
 */
import React, { useEffect, useRef } from 'react';
import { 
  setupGlobalKillSwitch, 
  setAnimationProtection, 
  isAnimationProtected,
  isProcessingComplete,
  resetChatSession
} from './killSwitch';

/**
 * Hook to setup kill switch listeners
 * @param onComplete Optional callback to run when kill switch is activated
 * @returns Function to trigger the kill switch manually
 */
export function useKillSwitch(onComplete?: () => void) {
  useEffect(() => {
    // Setup the global kill switch mechanism
    setupGlobalKillSwitch();
    
    // Setup listener for kill switch activation
    const handleKillSwitch = () => {
      console.log('Kill switch activated - executing cleanup');
      
      if (onComplete) {
        onComplete();
      }
    };
    
    // Listen for the kill event
    document.addEventListener('globalProcessingKilled', handleKillSwitch);
    
    // Clean up 
    return () => {
      document.removeEventListener('globalProcessingKilled', handleKillSwitch);
    };
  }, [onComplete]);

  // Return trigger function to manually activate the kill switch
  return () => {
    if (typeof window !== 'undefined' && window.__killAllProcessing) {
      window.__killAllProcessing();
    }
  };
}

/**
 * Component that listens for final message events from the streaming component
 * and activates the kill switch when appropriate
 */
export const FinalMessageKillSwitchListener: React.FC = () => {
  // Ref to track last reset timestamp to avoid race conditions
  const lastResetTimeRef = useRef<number>(Date.now());
  
  useEffect(() => {
    const handleFinalMessageDetected = (e: Event) => {
      const event = e as CustomEvent;
      
      console.log('Final message detected event captured by kill switch listener', 
                  event.detail?.preserveTraceData ? '(preserve mode)' : '');
      
      // Phase 1 (preserveTraceData=true) is handled directly in the killSwitch.ts setupGlobalKillSwitch
      // This is just for logging/debug purposes
    };
    
    // Handler for verification events - critical to recover from stuck messages
    const handleVerifyFinalMessageProcessing = (e: Event) => {
      const event = e as CustomEvent;
      const timestamp = event.detail?.timestamp || Date.now();
      const content = event.detail?.content;
      const messageId = event.detail?.messageId;
      
      console.log(`💡 Message verification requested: ${messageId}, len=${content?.length || 0}`);
      
      // Check if this message has been properly processed
      const isMessageComplete = isProcessingComplete();
      
      if (!isMessageComplete && content) {
        // Message is stuck - force complete it
        console.log(`🚨 Message ${messageId} appears to be stuck - forcing completion`);
        
        // Force completion via both event mechanisms
        document.dispatchEvent(new Event('forceCompleteTextContent'));
        
        // Additionally trigger direct rendering
        dispatchFinalMessageRendered(content);
      }
    };
    
    const handleFinalMessageRendered = () => {
      console.log('Final message rendered event captured by kill switch listener - activating complete kill switch');
      
      // Phase 2 is also handled in killSwitch.ts
      // This is just for logging/debug purposes
    };
    
    // Handler for Supervisor final responses - ensure they're properly processed
    const handleSupervisorFinalResponse = (e: Event) => {
      const event = e as CustomEvent;
      const content = event.detail?.content;
      const detectionTime = event.detail?.detectionTime || Date.now();
      const receivedTime = Date.now();
      
      if (content && typeof content === 'string') {
        console.log(`⏱️ [${receivedTime}] TIMING: Kill switch received supervisorFinalResponse event (delay from detection: ${receivedTime - detectionTime}ms)`);
        
        // First ensure we stop all animations in progress
        document.dispatchEvent(new Event('stopAllTextAnimations'));
        
        // Dispatch final message detected event (Phase 1)
        dispatchFinalMessageDetected(content);
        
        // Immediately dispatch final message rendered (Phase 2) with zero delay for maximum speed
        // Use Promise.resolve().then() for microtask queue - even faster than setTimeout(0)
        Promise.resolve().then(() => {
          const renderTime = Date.now();
          console.log(`⏱️ [${renderTime}] TIMING: Kill switch dispatching finalMessageRendered event (delay from received: ${renderTime - receivedTime}ms, total: ${renderTime - detectionTime}ms)`);
          dispatchFinalMessageRendered(content);
        });
      }
    };
    
    // Add handler for non-Supervisor agent final responses
    const handleAgentFinalResponse = (e: Event) => {
      const event = e as CustomEvent;
      const content = event.detail?.content;
      const agentName = event.detail?.agentName || 'Unknown';
      const detectionTime = event.detail?.detectionTime || Date.now();
      const receivedTime = Date.now();
      
      if (content && typeof content === 'string') {
        console.log(`⏱️ [${receivedTime}] TIMING: Kill switch received ${agentName} final response event (delay from detection: ${receivedTime - detectionTime}ms)`);
        
        // Dispatch final message detected event (Phase 1)
        dispatchFinalMessageDetected(content);
        
        // Immediately dispatch final message rendered (Phase 2) with zero delay
        setTimeout(() => {
          const renderTime = Date.now();
          console.log(`⏱️ [${renderTime}] TIMING: Kill switch dispatching finalMessageRendered for ${agentName} (delay from received: ${renderTime - receivedTime}ms, total: ${renderTime - detectionTime}ms)`);
          dispatchFinalMessageRendered(content);
        }, 0); // Reduced to 0ms for maximum speed - consistent with supervisor handler
      }
    };
    
    // Handler for session reset events - mark the time to prevent race conditions
    const handleChatSessionReset = (e: Event) => {
      const event = e as CustomEvent;
      const resetTime = Date.now();
      lastResetTimeRef.current = resetTime;
      
      console.log('Chat session reset event captured by kill switch listener', 
                  event.detail?.source ? `(source: ${event.detail.source})` : '');
                  
      // When session is reset, we shouldn't process any pending final message events
      // that might have been queued before the reset
    };
    
    document.addEventListener('finalMessageDetected', handleFinalMessageDetected);
    document.addEventListener('finalMessageRendered', handleFinalMessageRendered);
    document.addEventListener('supervisorFinalResponse', handleSupervisorFinalResponse);
    document.addEventListener('supervisorFinalResponseRendered', handleSupervisorFinalResponse);
    document.addEventListener('agentFinalResponseRendered', handleAgentFinalResponse); // New event for non-Supervisor agents
    document.addEventListener('chatSessionReset', handleChatSessionReset);
    document.addEventListener('verifyFinalMessageProcessing', handleVerifyFinalMessageProcessing);
    
    return () => {
      document.removeEventListener('finalMessageDetected', handleFinalMessageDetected);
      document.removeEventListener('finalMessageRendered', handleFinalMessageRendered);
      document.removeEventListener('supervisorFinalResponse', handleSupervisorFinalResponse);
      document.removeEventListener('supervisorFinalResponseRendered', handleSupervisorFinalResponse);
      document.removeEventListener('agentFinalResponseRendered', handleAgentFinalResponse); // Clean up listener
      document.removeEventListener('chatSessionReset', handleChatSessionReset);
      document.removeEventListener('verifyFinalMessageProcessing', handleVerifyFinalMessageProcessing);
    };
  }, []);
  
  // This is a utility component with no visual rendering
  return null;
};

/**
 * Helper function to detect final messages from trace data or content
 * Uses multiple detection methods for robustness
 */
export function isFinalMessage(traceData?: any, content?: string): boolean {
  // Method 1: Check explicit completion flags in trace data (most reliable)
  if (traceData) {
    // Check for Supervisor final response flag
    if (traceData.isSupervisorFinalResponse === true) {
      console.log('Detected Supervisor final response flag in trace data');
      return true;
    }
    
    // Check other completion flags
    if (
      traceData.responseComplete === true ||
      traceData.content?.responseComplete === true ||
      traceData.onUpdateChat?.responseComplete === true ||
      // Check for final response in orchestration trace
      traceData.content?.trace?.orchestrationTrace?.observation?.finalResponse ||
      traceData.trace?.orchestrationTrace?.observation?.finalResponse ||
      // Check if this is a trace with originalAgentType of Supervisor and "Final Response" in title or text
      (traceData.originalAgentType === 'Supervisor' && 
        ((traceData.tasks && traceData.tasks.some((t: any) => t.title === 'Final Response')) ||
         (traceData.text && typeof traceData.text === 'string' && traceData.text.includes('Final Response'))))
    ) {
      return true;
    }
  }

    // Method 2: Check for textual indicators in content (fallback)
    if (content) {
      // These are common phrases that might indicate a final response
      const finalPhrases = [
        "Can I help you with anything else?",
        "Is there anything else",
        "In conclusion",
        "To summarize",
        "I hope this helps",
        "Please let me know if you have any questions",
        "Please let me know if you need any clarification",
        "Is there anything else you would like to know",
        "Do you have any questions",
        // Product-specific phrases
        "Recommended Products:",
        "Recommended Products",
        "Troubleshooting Tips:",
        "Troubleshooting Tips",
        "ThunderBolt Speaker",
        "SonicWave Bluetooth Speaker",
        // Smartwatch-related terms
        "VitaFit Smartwatch",
        "smartwatch recommendations",
        "personalized smartwatch",
        "reinstalling the companion",
        "factory reset",
        // Apple product terms
        "Apple Watch",
        "Product ID:",
        "personalized product recommendations",
        "browsing history",
        "Based on your preferences"
      ];
    
    return finalPhrases.some(phrase => content.includes(phrase));
  }
  
  return false;
}

// Global tracking of the last chat session reset time to prevent processing obsolete events
let lastSessionResetTime = Date.now();

// Function to update the last session reset time when a reset occurs
document.addEventListener('chatSessionReset', () => {
  lastSessionResetTime = Date.now();
  console.log('Updated lastSessionResetTime to:', lastSessionResetTime);
});

/**
 * Helper function to cleanly dispatch the finalMessageDetected event
 * to trigger phase 1 of the kill switch (preserve trace data mode)
 */
export function dispatchFinalMessageDetected(content: string, traceData?: any) {
  const eventTimestamp = Date.now();
  
  // Check if this event is stale (from before the last reset)
  // Events generated after a reset should still be processed
  if (eventTimestamp < lastSessionResetTime) {
    console.log(`⚠️ Skipping finalMessageDetected event - it's from before the last session reset`);
    return Promise.resolve(); // Skip processing this event
  }
  
  // CRITICAL FIX: Check if processing is already complete to prevent duplicate events
  if (typeof window !== 'undefined' && window.__processingComplete) {
    console.log(`⚠️ Processing is already complete - skipping finalMessageDetected event`);
    return Promise.resolve(); // Skip processing this event
  }
  
  // First ensure we stop all animations in progress
  document.dispatchEvent(new Event('stopAllTextAnimations'));
  
  // Then dispatch the final message detected event
  const finalMessageDetectedEvent = new CustomEvent('finalMessageDetected', {
    detail: { 
      content: content,
      traceData: traceData, // Include trace data for more context
      timestamp: eventTimestamp,
      preserveTraceData: true,  // Flag to indicate trace data should be preserved
      messageId: `msg-${eventTimestamp}` // Add unique ID for tracking
    }
  });
  console.log(`🚨 Dispatching finalMessageDetected event - Phase 1 kill switch (content: ${content.substring(0, 30)}...)`);
  document.dispatchEvent(finalMessageDetectedEvent);
  
  // Return a promise that resolves when the event has been dispatched
  return new Promise(resolve => setTimeout(resolve, 10));
}

/**
 * Helper function to cleanly dispatch the finalMessageRendered event
 * to trigger phase 2 of the kill switch (complete shutdown)
 */
export function dispatchFinalMessageRendered(content: string, traceData?: any) {
  const eventTimestamp = Date.now();
  
  // Check if this event is stale (from before the last reset)
  if (eventTimestamp < lastSessionResetTime) {
    console.log(`⚠️ Skipping finalMessageRendered event - it's from before the last session reset`);
    return; // Skip processing this event
  }
  
  // CRITICAL FIX: Check if processing is already complete to prevent duplicate events
  if (typeof window !== 'undefined' && window.__processingComplete) {
    console.log(`⚠️ Processing is already complete - skipping finalMessageRendered event`);
    
    // Clear trace cache to prevent reprocessing loops
    try {
      localStorage.removeItem('agent-trace-cache');
    } catch (e) {
      console.error("Error clearing trace cache:", e);
    }
    return; // Skip processing this event
  }
  
  // First ensure we stop all animations
  document.dispatchEvent(new Event('stopAllTextAnimations'));
  
  // Use a small timeout to ensure UI updates before dispatching the final event
  setTimeout(() => {
    const finalMessageRenderedEvent = new CustomEvent('finalMessageRendered', {
      detail: { 
        timestamp: eventTimestamp,
        content: content,
        traceData: traceData, // Include trace data for more context
        messageId: `msg-${eventTimestamp}` // Add unique ID for tracking
      }
    });
    console.log(`🚨 Dispatching finalMessageRendered event - Phase 2 kill switch (content: ${content.substring(0, 30)}...)`);
    document.dispatchEvent(finalMessageRenderedEvent);
  }, 50); // Small delay to ensure animations complete first
}

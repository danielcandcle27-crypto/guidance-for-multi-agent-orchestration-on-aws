import React, { useState, useRef, useEffect } from 'react';
import { TraceGroup } from './traceParser';
import { getAgentTrace, storeAgentTrace } from './agentTraceStorage';
import { parseAttributeAsNumber } from './safeTraceUtils';
import { 
  dispatchFinalMessageDetected,
  dispatchFinalMessageRendered,
  useKillSwitch,
  isFinalMessage
} from './finalMessageKillSwitch';
import { 
  safeSetTimeout, 
  setAnimationProtection, 
  isAnimationProtected,
  isProcessingComplete,
  resetChatSession
} from './killSwitch';

/**
 * Utility function to clean up localStorage items related to message tracking
 * This helps prevent QuotaExceededError by removing old message data before storing new ones
 * @returns The number of items cleaned up
 */
export const cleanupLocalStorageMessages = (preserveRecent: boolean = true): number => {
  console.log('🧹 Starting localStorage message cleanup');
  
  // Track how many items we clean up
  let cleanupCount = 0;
  
  // Check if any message is currently being processed by the Supervisor agent
  const isSupervisorProcessing = document.querySelector('.node-processing[id="supervisor-agent"]') !== null;
  
  // First backup any important content that might be needed for recovery
  // This is reduced compared to full backups in resetChatSession to avoid storage bloat
  try {
    // Create a single compact backup of recent complete messages
    const recentKeys: string[] = [];
    const recentData: Record<string, string> = {};
    
    // Find the 3 most recent complete message keys (based on timestamp in key)
    const messageKeys: {key: string, timestamp: number}[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('complete_message_')) {
        // Extract timestamp from key (complete_message_TIMESTAMP)
        const timestampStr = key.split('_').pop();
        if (timestampStr) {
          const timestamp = parseInt(timestampStr);
          if (!isNaN(timestamp)) {
            messageKeys.push({ key, timestamp });
          }
        }
      }
    }
    
    // Sort by timestamp (descending) and keep only most recent 3
    messageKeys.sort((a, b) => b.timestamp - a.timestamp);
    const recentMessageKeys = messageKeys.slice(0, 3);
    
    // Store these in our backup
    for (const { key } of recentMessageKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        recentData[key] = value;
        recentKeys.push(key);
      }
    }
    
    // Only create backup if we have messages to back up
    if (recentKeys.length > 0) {
      const backupKey = `message_backup_mini_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(recentData));
      console.log(`💾 Created mini-backup of ${recentKeys.length} recent messages with key: ${backupKey}`);
    }
  } catch (e) {
    console.error('Error creating message mini-backup during cleanup:', e);
  }
  
  // Now find and remove all complete_message items, with special handling
  const messagesToClear = [];
  const supervisorMessages = [];
  const recentMessages = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Target only complete_message keys but preserve backups
    if (key && key.startsWith('complete_message_')) {
      // Keep track of supervisor messages separately
      const value = localStorage.getItem(key);
      if (value && 
          (value.includes('Supervisor final response') || 
           value.includes('Final Response') && value.includes("Can I help you with anything else?"))) {
        supervisorMessages.push(key);
        console.log('🔒 Preserving supervisor final message:', key);
      } else if (preserveRecent && key.includes(Date.now().toString().substring(0, 8))) {
        // This is a very recent message (from today), keep it
        recentMessages.push(key);
        console.log('🔒 Preserving recent message:', key);
      } else {
        messagesToClear.push(key);
      }
    }
  }
  
  // Remove only the non-supervisor, non-recent messages
  messagesToClear.forEach(key => {
    localStorage.removeItem(key);
    cleanupCount++;
  });
  
  console.log(`🧹 Cleaned up ${cleanupCount} message entries from localStorage`);
  return cleanupCount;
};

// Helper function to determine if a text or trace data indicates a final response
export const isFinalResponseContent = (content: string, traceData?: any): boolean => {
  // Check for Supervisor related trace indicators first (most reliable)
  if (traceData) {
    // Explicit supervisor final response flag
    if (traceData.isSupervisorFinalResponse === true) {
      return true;
    }
    
    // Check if this is a trace with originalAgentType of Supervisor and has a Final Response task
    if (traceData.originalAgentType === 'Supervisor' && 
        traceData.tasks && 
        traceData.tasks.some((t: any) => t.title === 'Final Response')) {
      return true;
    }
  }
  
  // Use the comprehensive detection from finalMessageKillSwitch as fallback
  if (isFinalMessage(traceData, content)) {
    return true;
  }
  
  // Additional detection for common phrases that might indicate a final response
  // This is a fallback in case the main detection doesn't catch it
  if (content) {
    const finalPhrases = [
      "Can I help you with anything else?",
      "Is there anything else",
      "In conclusion",
      "To summarize",
      "I hope this helps",
      "Please let me know if you have any questions",
      "Please let me know if you need any clarification",
      "Final Response" // Explicitly check for "Final Response" text
    ];
    
    // Product-specific patterns
    const productPatterns = [
      "Recommended Products:",
      "Troubleshooting Tips:",
      "ThunderBolt Speaker",
      "SonicWave Bluetooth Speaker",
      // Smartwatch-related terms
      "VitaFit Smartwatch",
      "smartwatch recommendations",
      "personalized smartwatch",
      "reinstalling the companion",
      "factory reset",
      "smartwatch with a non-responsive screen",
      // Apple product terms
      "Apple Watch",
      "Product ID:",
      "personalized product recommendations",
      "browsing history",
      "Based on your preferences",
      "Rating:",
      "Price:",
      "AirPods"
    ];
    
    // Check for both general final phrases and product-specific patterns
    const hasFinalPhrase = finalPhrases.some(phrase => content.includes(phrase));
    const hasProductPattern = productPatterns.some(pattern => content.includes(pattern));
    
    // Consider product recommendations as final messages if they're substantial (over 500 chars)
    const isSubstantialProductResponse = 
      hasProductPattern && content.length > 500;
      
    return hasFinalPhrase || isSubstantialProductResponse;
  }
  
  return false;
};

// Parse markdown-style content into HTML for proper rendering with improved text wrapping and bullet points
export const parseMarkdown = (markdown: string): string => {
  // Convert bold syntax (both * and _)
  let html = markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
    .replace(/__(.*?)__/g, '<strong>$1</strong>');    // __bold__
  
  // Convert headings with text wrapping
  html = html.replace(/^### (.*?)$/gm, '<h3 style="overflow-wrap: break-word; word-break: break-word; width: 100%;">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 style="overflow-wrap: break-word; word-break: break-word; width: 100%;">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 style="overflow-wrap: break-word; word-break: break-word; width: 100%;">$1</h1>');
  
  // Enhanced list item conversion with better formatting
  html = html.replace(/^- (.*?)$/gm, '<li style="text-align: left; display: list-item; margin-bottom: 8px;">$1</li>');
  html = html.replace(/^\* (.*?)$/gm, '<li style="text-align: left; display: list-item; margin-bottom: 8px;">$1</li>');
  html = html.replace(/^\d+\. (.*?)$/gm, '<li style="text-align: left; display: list-item; margin-bottom: 8px;">$1</li>');
  
  // Improved list wrapping logic for proper nesting and display
  // First check if there are any list items
  if (html.includes('<li')) {
    // Gather all list items
    const listPattern = /(<li.*?>.*?<\/li>)/g;
    const listItems = html.match(listPattern) || [];
    
    if (listItems.length > 0) {
      // Group consecutive list items into proper HTML lists with appropriate styling
      let inList = false;
      let processedHtml = html;
      
      // Replace sequences of list items with properly formatted lists
      processedHtml = processedHtml.replace(/(<li.*?>.*?<\/li>)(\s*)(?=<li|$)/g, (match, listItem, spacing, offset, string) => {
        // If this is the first item in a sequence, start a new list
        if (!inList) {
          inList = true;
          return `<ul style="padding-left: 16px; width: auto; max-width: calc(100% - 16px); margin-top: 8px; margin-bottom: 12px;">${listItem}`;
        }
        
        // If this is the last item in a sequence (no more <li> tags follow), end the list
        const isLastItem = !string.substring(offset + match.length).includes('<li');
        if (isLastItem) {
          inList = false;
          return `${listItem}</ul>`;
        }
        
        // Otherwise, just return the list item
        return listItem;
      });
      
      // Ensure all lists are properly closed
      if (inList) {
        processedHtml += '</ul>';
      }
      
      html = processedHtml;
    }
  }
  
  // Convert paragraphs (lines separated by two newlines) with text wrapping
  html = html.replace(/\n\n/g, '</p><p style="overflow-wrap: break-word; word-break: break-word; max-width: 100%;">');
  
  // Convert italic syntax
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Handle code blocks with proper wrapping
  html = html.replace(/```(.*?)```/gs, '<pre style="white-space: pre-wrap; overflow-x: auto; word-break: break-word; max-width: 100%;">$1</pre>');
  
  // Handle inline code
  html = html.replace(/`([^`]+)`/g, '<code style="white-space: pre-wrap; word-break: break-all; max-width: 100%;">$1</code>');
  
  // Convert newlines to <br> within paragraphs
  html = html.replace(/\n/g, '<br>');
  
  // Wrap everything in a paragraph if not starting with a tag
  if (!html.startsWith('<')) {
    html = `<p style="overflow-wrap: break-word; word-break: break-word; max-width: 100%;">${html}</p>`;
  }
  
  // Make sure everything is properly wrapped in paragraphs with text wrapping
  html = `<div class="markdown-content" style="max-width: 100%; overflow-wrap: break-word;">${html}</div>`;
  
  return html;
};

// Formatted Assistant Response Component with enhanced streaming
interface FinalMessageStreamingProps { 
  content: string; 
  onAnimationStart?: () => void;
  onAnimationComplete?: (isDone: boolean) => void;
  messageId?: string;
  traceData?: any; // Add traceData parameter for final response detection
}

// Debug console log for animation state
const debugAnimationState = (id: string, status: string) => {
  console.log(`🎬 ANIMATION ${status}: ${id} at ${Date.now()}`);
};

// Use memo with custom equality function to prevent unnecessary re-renders
export const FinalMessageStreaming = React.memo(
  ({ content, onAnimationStart, onAnimationComplete, messageId, traceData }: FinalMessageStreamingProps) => {
    // Clean up localStorage on component initialization
    useEffect(() => {
      // Clean up localStorage when component mounts (happens on page refresh too)
      console.log('🧹 FinalMessageStreaming component initialized, cleaning up localStorage');
      cleanupLocalStorageMessages();
      
      // Set up listener for new message submissions to clean localStorage before sending
      const handleNewMessageSubmit = () => {
        console.log('🧹 New message being submitted, cleaning up localStorage');
        cleanupLocalStorageMessages();
      };
      
      // Listen for new message submission events
      document.addEventListener('newMessageSubmission', handleNewMessageSubmit);
      
      return () => {
        document.removeEventListener('newMessageSubmission', handleNewMessageSubmit);
      };
    }, []);

    // Calculate initial state values
    const isGreeting = content === "Hello, how can I assist you?";
    const isFinal = content && typeof content === 'string' && isFinalResponseContent(content);
    
  // For initial message, skip animation for greetings entirely
  // For subsequent messages, always start with empty content to allow animation
  const shouldSkipInitialAnimation = isGreeting;
  const initialContent = shouldSkipInitialAnimation ? content : '';
  const initialHtml = shouldSkipInitialAnimation ? parseMarkdown(content) : '';
  
  // Set states with immediate content for greeting, empty for everything else to force animation
  const [displayedText, setDisplayedText] = useState(initialContent);
  const [processedHtml, setProcessedHtml] = useState(initialHtml);
  // Start with isDone true only for greetings
  const [isDone, setIsDone] = useState(shouldSkipInitialAnimation);

    // Debug component initialization
    console.log(`Component initialized: msgId=${messageId}, content=${!!content}(${content?.length || 0}), html=${!!processedHtml}, isDone=${isDone}`);

    // Add event listener for Supervisor and other agent Final Response events
  useEffect(() => {
    const handleSupervisorFinalResponse = (e: Event) => {
      const event = e as CustomEvent;
      const content = event.detail?.content;
      const detectionTime = event.detail?.detectionTime || Date.now();
      const receivedTime = Date.now();
      
      if (content && typeof content === 'string') {
        console.log(`⏱️ [${receivedTime}] TIMING: finalMessageStreaming received supervisorFinalResponse event (delay: ${receivedTime - detectionTime}ms), content length: ${content.length}`);
        
        // Update the content reference to ensure it gets rendered
        fullContentRef.current = content;
        
        // If this message matches our component's messageId, render it immediately
        if (messageId === event.detail?.traceId || !messageId) {
          console.log(`⏱️ [${receivedTime}] TIMING: Supervisor final response matches this component, initiating immediate render`);
          
          // Clear any existing streaming timer
          clearStreamTimer();
          
          // For faster rendering, use more initial characters
          const initialChars = Math.min(content.length, 30); // Increased from 15 to 30
          setDisplayedText(content.substring(0, initialChars));
          setProcessedHtml(parseMarkdown(content.substring(0, initialChars)));
          setIsDone(false); // Ensure animation runs
          
          // Clean up localStorage first, then store the new message
          if (messageId) {
            // Clean up before saving but preserve recent and important messages
            cleanupLocalStorageMessages(true);
            // Ensure supervisor final messages are always saved
            localStorage.setItem(`complete_message_${messageId}`, content);
            console.log(`💾 Backup saved for Supervisor final message ${messageId}`);
          }
          
          // Mark as final for proper handling
          hasFinalResponseRef.current = true;
          
          // Force update with very short delay to ensure immediate visibility
          setTimeout(() => {
            const renderTime = Date.now();
            console.log(`⏱️ [${renderTime}] TIMING: Force updating full content for fast render (total delay: ${renderTime - detectionTime}ms)`);
            
            // Set displayed text to a larger chunk of content to speed up initial rendering
            const largerChunk = Math.min(content.length, content.length / 2);
            setDisplayedText(content.substring(0, largerChunk));
            setProcessedHtml(parseMarkdown(content.substring(0, largerChunk)));
          }, 10);
        }
      }
    };
    
    // Handler for other agent final responses
    const handleAgentFinalResponse = (e: Event) => {
      const event = e as CustomEvent;
      const content = event.detail?.content;
      const agentName = event.detail?.agentName || 'Unknown';
      const detectionTime = event.detail?.detectionTime || Date.now();
      const receivedTime = Date.now();
      
      if (content && typeof content === 'string') {
        console.log(`⏱️ [${receivedTime}] TIMING: finalMessageStreaming received ${agentName} final response event (delay: ${receivedTime - detectionTime}ms), content length: ${content.length}`);
        
        // Update the content reference to ensure it gets rendered
        fullContentRef.current = content;
        
        // If this message matches our component's messageId, render it immediately
        if (messageId === event.detail?.traceId || !messageId) {
          console.log(`⏱️ [${receivedTime}] TIMING: ${agentName} final response matches this component, initiating immediate render`);
          
          // Clear any existing streaming timer
          clearStreamTimer();
          
          // For faster rendering, use more initial characters
          const initialChars = Math.min(content.length, 30);
          setDisplayedText(content.substring(0, initialChars));
          setProcessedHtml(parseMarkdown(content.substring(0, initialChars)));
          setIsDone(false); // Ensure animation runs
          
          // Clean up localStorage first, then store the new message
          if (messageId) {
            // Clean up before saving, preserving recent and important messages
            cleanupLocalStorageMessages(true);
            localStorage.setItem(`complete_message_${messageId}`, content);
          }
          
          // Mark as final for proper handling
          hasFinalResponseRef.current = true;
          
          // Force update with very short delay
          setTimeout(() => {
            const renderTime = Date.now();
            console.log(`⏱️ [${renderTime}] TIMING: Force updating full content for ${agentName} (total delay: ${renderTime - detectionTime}ms)`);
            
            // Set displayed text to a larger chunk of content to speed up initial rendering
            const largerChunk = Math.min(content.length, content.length / 2);
            setDisplayedText(content.substring(0, largerChunk));
            setProcessedHtml(parseMarkdown(content.substring(0, largerChunk)));
          }, 10);
        }
      }
    };
    
    document.addEventListener('supervisorFinalResponse', handleSupervisorFinalResponse);
    document.addEventListener('supervisorFinalResponseRendered', handleSupervisorFinalResponse);
    document.addEventListener('agentFinalResponseRendered', handleAgentFinalResponse);
    
    return () => {
      document.removeEventListener('supervisorFinalResponse', handleSupervisorFinalResponse);
      document.removeEventListener('supervisorFinalResponseRendered', handleSupervisorFinalResponse);
      document.removeEventListener('agentFinalResponseRendered', handleAgentFinalResponse);
    };
  }, [messageId]);

  // Modified effect to support streaming behavior with localStorage backup - with reset for each new message
    useEffect(() => {
      if (content) {
        console.log(`Content change detected (${content.length} chars), msgId=${messageId}`);
        
        // Detect if this is a completely new message (different messageId)
        if (messageId !== prevMessageIdRef.current) {
          console.log(`New message detected (previous: ${prevMessageIdRef.current}, current: ${messageId})`);
          prevMessageIdRef.current = messageId;
          
          // Always reset state for new messages to ensure animation happens
          if (!isGreeting) {
            console.log(`Resetting state for new message ${messageId}`);
            setDisplayedText('');
            setProcessedHtml('');
            setIsDone(false);
            // Reset other internal state
            initialRenderRef.current = true;
            hasFinalResponseRef.current = false;
          }
        }
        
        // First check if we have a complete message saved in localStorage for this message ID
        let completeContent = content;
        if (messageId) {
          const savedComplete = localStorage.getItem(`complete_message_${messageId}`);
          if (savedComplete && savedComplete.length >= content.length) {
            console.log(`💾 Found saved complete message in localStorage for ${messageId}, length=${savedComplete.length}`);
            // Use the saved complete message as our content source
            completeContent = savedComplete;
          }
        }
        
        // Store the complete content reference
        fullContentRef.current = completeContent;
        
        // Only set full content immediately for greetings
        // This allows all other messages to stream properly
        const isGreetingMessage = completeContent === "Hello, how can I assist you?";
        
        if (isGreetingMessage) {
          console.log(`Immediate display for greeting: ${isGreeting ? 'greeting' : 'final'}`);
          setDisplayedText(completeContent);
          const html = parseMarkdown(completeContent);
          setProcessedHtml(html);
          setIsDone(true); // Mark as done to prevent streaming
          
          hasFinalResponseRef.current = true;
        } 
        // For final messages, enable streaming animation
        else if (isFinal) {
          console.log(`Final message detected - enabling character-by-character animation: ${completeContent.substring(0, 30)}...`);
          // Mark as final but don't set isDone yet to allow streaming
          hasFinalResponseRef.current = true;
          // Start with empty to enable animation
          setDisplayedText('');
          setProcessedHtml('');
          setIsDone(false); // Explicitly ensure animation can start
        }
        else if (initialRenderRef.current) {
          // For initial render of non-greeting/final messages, start with empty text
          // to allow streaming animation to work properly
          console.log(`Initial render for message ${messageId}, enabling streaming`);
          initialRenderRef.current = false;
          
          // Start with empty text to enable streaming
          // Don't set displayedText here - let the streaming effect handle it
        }
      }
    }, [content, messageId]);
    
    // Debug rendering
    useEffect(() => {
      console.log(`RENDER STATE: msgId=${messageId}, content=${!!content} (${content?.length || 0}), displayedText=${!!displayedText} (${displayedText?.length || 0}), processedHtml=${!!processedHtml} (${processedHtml?.length || 0}), isDone=${isDone}`);
    }, [content, displayedText, processedHtml, isDone, messageId]);
    
    // Message state tracking refs
    const fullContentRef = useRef(content);
    const streamTimerRef = useRef<NodeJS.Timeout | null>(null);
    const responseIdRef = useRef(`response-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    const initialRenderRef = useRef(true);
    const hasFinalResponseRef = useRef(isGreeting);
    const prevMessageIdRef = useRef<string | undefined>(messageId);
    
    // Reference to track if we should allow interruption
    const allowInterruptRef = useRef(true);
    
    // Reference to track animation state
    const animationStateRef = useRef({
      isAnimating: false,
      forceCompleted: false,
      originalContent: '',
    });
    
    // Listen for chat session reset events
    useEffect(() => {
      // Handler for session reset events - clean up state and stop animations
      const handleChatSessionReset = () => {
        console.log(`🔄 Chat session reset detected by FinalMessageStreaming component (msgId=${messageId})`);
        
        // Clear any streaming timer
        if (streamTimerRef.current) {
          clearTimeout(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        
        // If this is a final message or greeting, skip further processing
        // as those should be preserved for UX consistency
        if (isGreeting || (isDone && isFinalResponseContent(fullContentRef.current))) {
          console.log('Final message or greeting - skipping session reset handling');
          return;
        }
        
        // For messages in progress, only complete rendering if we're near the end
        // This avoids flicker when a user sends a new message while an assistant response is streaming in
        const percentComplete = fullContentRef.current.length > 0 ? 
          (displayedText.length / fullContentRef.current.length) * 100 : 100;
          
        if (percentComplete > 80) {
          // If we're near completion, finish rendering the full content
          // This creates smoother transitions when resetting
          setDisplayedText(fullContentRef.current);
          setProcessedHtml(parseMarkdown(fullContentRef.current));
          setIsDone(true);
        }
        
        // Clean up any localStorage backups for this message if they exist
        if (messageId) {
          const storageKey = `complete_message_${messageId}`;
          if (localStorage.getItem(storageKey)) {
            localStorage.removeItem(storageKey);
            console.log(`🧹 Cleaned up localStorage for message ${messageId}`);
          }
        }
      };
      
      document.addEventListener('chatSessionReset', handleChatSessionReset);
      
      return () => {
        document.removeEventListener('chatSessionReset', handleChatSessionReset);
      };
    }, [messageId, isDone, displayedText.length]);
    
    // Stop streaming when the specific event is triggered, with enhanced safety
    useEffect(() => {
      const handleStopAnimation = (e: Event) => {
        const customEvent = e as CustomEvent;
        const isUserTriggered = customEvent?.detail?.source === 'user_interaction';
        const canOverrideProtection = customEvent?.detail?.allowOverrideProtection === true;
        
        debugAnimationState(responseIdRef.current.substring(0, 6), 
          `ANIMATION STOP REQUESTED${isUserTriggered ? ' (USER TRIGGERED)' : ''}`);
        
        // Store the animation state
        animationStateRef.current = {
          isAnimating: !isDone && displayedText.length < fullContentRef.current.length,
          forceCompleted: true,
          originalContent: fullContentRef.current
        };
        
        console.log(`Animation stop event - Currently at ${displayedText.length}/${fullContentRef.current.length} chars`);
        
        // If we're in the middle of critical rendering, don't allow interruption
        // Unless we're already near the end (> 90%) or user explicitly triggered with override
        const percentComplete = fullContentRef.current.length > 0 ? 
          (displayedText.length / fullContentRef.current.length) * 100 : 100;
          
        if (!allowInterruptRef.current && percentComplete < 90 && !(isUserTriggered && canOverrideProtection)) {
          console.log(`🔒 Animation protection active - preventing interruption at ${percentComplete.toFixed(1)}% complete`);
          return;
        }
        
        // Clear any streaming timer
        if (streamTimerRef.current) {
          clearTimeout(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        
        // Ensure we set the full text immediately 
        setDisplayedText(fullContentRef.current);
        setProcessedHtml(parseMarkdown(fullContentRef.current));
        setIsDone(true);
        
        // Notify parent of completion
        if (onAnimationComplete) {
          onAnimationComplete(true);
        }
        
        // Log for debugging
        console.log(`Animation forcibly completed, set full content of ${fullContentRef.current.length} chars`);
      };
      
      // Handler for explicit force complete content event
      const handleForceComplete = () => {
        console.log(`🔄 Force complete content event received for message ${messageId}`);
        
        // Always set the full content regardless of protection
        setDisplayedText(fullContentRef.current);
        setProcessedHtml(parseMarkdown(fullContentRef.current));
        setIsDone(true);
        
        // Notify parent of completion
        if (onAnimationComplete) {
          onAnimationComplete(true);
        }
      };
      
      document.addEventListener('stopAllTextAnimations', handleStopAnimation);
      document.addEventListener('forceCompleteTextContent', handleForceComplete);
      
      return () => {
        document.removeEventListener('stopAllTextAnimations', handleStopAnimation);
        document.removeEventListener('forceCompleteTextContent', handleForceComplete);
      };
    }, [onAnimationComplete, displayedText.length, isDone, messageId]);
    
  // Effect to lock animation protection when the final message phrases are detected
  // and force completion for final messages to ensure they don't stay in loading state
  // ENHANCED with multiple fail-safe mechanisms and special handling for OrderManagement agent
  useEffect(() => {
    // Multiple detection paths to ensure final messages are properly handled
    const hasFinalPhrases = isFinalResponseContent(fullContentRef.current);
    const isStaticContent = fullContentRef.current === displayedText && fullContentRef.current.length > 0;
    const isFinalByMetadata = traceData?.hasFinalResponse || traceData?.isSupervisorFinalResponse;
    
    // Check if this is OrderManagement or other special agent
    const isOrderManagement = 
      traceData?.originalAgentType === 'OrderManagement' || 
      (traceData?.agentId && (traceData.agentId.includes('order') || traceData.agentId.includes('management')));
    
    // Combined check using multiple detection methods for robustness
    const isFinalMessage = hasFinalPhrases || isFinalByMetadata || 
                          (isStaticContent && fullContentRef.current.length > 100);
    
    if (isFinalMessage) {
      console.log('🔒 Final message detected, activating animation lock for protection');
      console.log(`Detection sources: phrases=${hasFinalPhrases}, metadata=${isFinalByMetadata}, static=${isStaticContent}, isOrderManagement=${isOrderManagement}`);
      
      allowInterruptRef.current = false;
      
      // For final messages, force completion after a shorter delay if not already complete
      if (!isDone) {
        console.log('🔄 Final message not yet complete, scheduling force-completion');
        
        // Use extremely short timeout for OrderManagement and Supervisor agents to reduce delay
        // This is a critical fix for the observed slowness with final responses
        const isSupervisor = 
          traceData?.originalAgentType === 'Supervisor' || 
          (traceData?.agentId && (traceData.agentId.includes('supervisor') || 
                                 traceData.agentId.includes('super')));
          
        // Use the shortest possible delay for these critical agents
        const completionDelay = isOrderManagement ? 200 : // OrderManagement even faster
                              isSupervisor ? 100 : // Supervisor gets fastest response
                              500; // Other agents still faster than before
        
        // Primary completion timer - shorter timeout (1 second or 0.5 seconds for OrderManagement)
        const completeTimer = setTimeout(() => {
          // Only force complete if we're still not done
          if (!isDone) {
            console.log(`⚡ Forcing completion of final message - primary timer (${isOrderManagement ? 'OrderManagement agent' : 'regular agent'})`);
            setDisplayedText(fullContentRef.current);
            setProcessedHtml(parseMarkdown(fullContentRef.current));
            setIsDone(true);
            
            // Notify parent of completion
            if (onAnimationComplete) {
              onAnimationComplete(true);
            }
            
            // Clear loading state globally and report completion
            document.dispatchEvent(new Event('forceCompleteTextContent'));
            document.dispatchEvent(new CustomEvent('finalMessageForceCompleted', {
              detail: { 
                content: fullContentRef.current,
                messageId,
                timestamp: Date.now(),
                isOrderManagement
              }
            }));
          }
        }, completionDelay);
        
        // Backup safety timer (5 seconds) - this is our final fail-safe
        const safetyTimer = setTimeout(() => {
          if (!isDone) {
            console.log('🚨 SAFETY TIMER: Force completing final message after extended timeout');
            setDisplayedText(fullContentRef.current);
            setProcessedHtml(parseMarkdown(fullContentRef.current));
            setIsDone(true);
            
            // Force global state cleanup with stronger event
            document.dispatchEvent(new Event('globalKillAllAnimations'));
            
            if (onAnimationComplete) {
              onAnimationComplete(true);
            }
          }
        }, 5000);
        
        // Verification timer to check if events were processed (2 seconds)
        const verificationTimer = setTimeout(() => {
          // Check if message is still showing as processing
          if (!isDone && document.dispatchEvent) {
            console.log('🔍 Verifying final message processing status');
            
            // Dispatch verification event which will trigger backup handlers
            document.dispatchEvent(new CustomEvent('verifyFinalMessageProcessing', {
              detail: { 
                messageId, 
                timestamp: Date.now(),
                content: fullContentRef.current 
              }
            }));
          }
        }, 2000);
        
        // Log diagnostics for debugging
        console.log(`🔍 [${Date.now()}] Final message status - 
          id: ${messageId}
          content length: ${fullContentRef.current?.length || 0}
          display length: ${displayedText?.length || 0}
          isDone: ${isDone}
          processing complete: ${isProcessingComplete()}
        `);
        
        // Track the timers for cleanup
        if (window.__activeTimers) {
          window.__activeTimers.push(completeTimer);
          window.__activeTimers.push(safetyTimer);
          window.__activeTimers.push(verificationTimer);
        }
        
        return () => {
          clearTimeout(completeTimer);
          clearTimeout(safetyTimer);
          clearTimeout(verificationTimer);
        };
      }
    }
  }, [fullContentRef.current, isDone, onAnimationComplete, messageId, traceData]);
    
    // Track when we have final response content but allow it to stream
    useEffect(() => {
      // Only process if content changed and we're not already done with this response
      if (content !== fullContentRef.current || !isDone) {
        fullContentRef.current = content;
        
        // Check for final response markers but don't stop streaming immediately
        if (content && typeof content === 'string' && isFinalResponseContent(content)) {
          const id = responseIdRef.current.substring(0, 6);
          debugAnimationState(id, "FINAL DETECTED - WILL STREAM");
          hasFinalResponseRef.current = true;
          
          // Create a backup in localStorage for final messages
          if (messageId) {
            // Clean up before saving, preserving recent and important messages
            cleanupLocalStorageMessages(true);
            localStorage.setItem(`complete_message_${messageId}`, content);
            console.log(`💾 Backup saved for final message ${messageId}`);
          }
          
          // Note: We DON'T set isDone here - let the streaming complete naturally
          // This allows the character-by-character animation to play out
        }
      }
    }, [content, isDone, onAnimationComplete, messageId]);
    
    // Helper to clear any existing timer
    const clearStreamTimer = () => {
      if (streamTimerRef.current) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };

    // Clean up on unmount
    useEffect(() => {
      return () => {
        debugAnimationState(responseIdRef.current.substring(0, 6), "UNMOUNT CLEANUP");
        clearStreamTimer();
      };
    }, []);

    // Update the full content reference when it changes significantly
    useEffect(() => {
      // Skip the first render since we already set initial state
      if (initialRenderRef.current) {
        initialRenderRef.current = false;
        return;
      }
      
      // Skip if this is a final response - we've already set it to done
      if (hasFinalResponseRef.current) {
        return;
      }
      
      // Only restart streaming if the content actually changed substantially
      // This prevents flickering when minor updates happen
      const contentLengthDiff = Math.abs(fullContentRef.current.length - content.length);
      
      if (fullContentRef.current !== content && contentLengthDiff > 30) {
        console.log("Content changed significantly, restarting streaming");
        fullContentRef.current = content;
        
        // Reset streaming state
        clearStreamTimer();
        setDisplayedText('');
        setProcessedHtml('');
        setIsDone(false);
      } else if (fullContentRef.current !== content) {
        // For minor updates, just silently update the reference without restarting
        fullContentRef.current = content;
      }
    }, [content]);

    // Initialize streaming for all messages except greetings
    useEffect(() => {
      // Skip if we don't have content or if processing is already complete
      if (!content || content.length === 0) return;

      // Skip for greetings only
      if (isGreeting) return;
      
      // For all other messages (including final ones), ensure we start streaming
      if (displayedText === '' && content) {
        const initialChars = Math.min(content.length, 10);
        setDisplayedText(content.substring(0, initialChars));
        setProcessedHtml(parseMarkdown(content.substring(0, initialChars)));
        console.log(`🎬 Starting streaming animation for message ${messageId}`);
      }
    }, [content, messageId, displayedText, isGreeting]);

    // COMPLETELY REPLACED STREAMING EFFECT - Final messages are displayed immediately, no animation
    useEffect(() => {
      // For any message, first check if it's a final message or product recommendation
      const isFinalContent = content && isFinalResponseContent(content);
      const hasProductTerms = content && (
        content.includes("ThunderBolt Speaker") || 
        content.includes("SonicWave") ||
        content.includes("Apple Watch") ||
        content.includes("Product ID:") ||
        content.includes("Recommended Products:") ||
        content.includes("Troubleshooting Tips:") ||
        content.includes("personalized product recommendations")
      );
      
      // Only skip animation for greetings, allow all other messages to stream including final ones
      if (isGreeting || isProcessingComplete()) {
        console.log(`⚠️ IMMEDIATE DISPLAY MODE: No animation for greeting only`);
        
        // Force immediate display of full content
        setDisplayedText(content || fullContentRef.current);
        setProcessedHtml(parseMarkdown(content || fullContentRef.current));
        setIsDone(true);
        
        // Notify parent when done
        if (onAnimationComplete) {
          onAnimationComplete(true);
        }
        
        return; // CRITICAL: Skip all streaming code below
      }
      
      // STREAMING CODE ONLY RUNS FOR NON-FINAL MESSAGES BEYOND THIS POINT

      // For final messages, we want to allow streaming but ensure proper completion later
      // This check is removed intentionally to allow streaming for final messages
      
      // Ensure content is displayed completely for non-streaming cases
      // This now only handles updating the initial state,
      // but doesn't prematurely finish streaming
      if (displayedText === '' && content) {
        console.log(`Initializing content for streaming, msgId=${messageId}`);
        // Start with first few characters to begin streaming naturally
        const initialChars = Math.min(10, content.length);
        setDisplayedText(content.substring(0, initialChars));
        setProcessedHtml(parseMarkdown(content.substring(0, initialChars)));
        
        // Store the full content for streaming
        fullContentRef.current = content;
        
        // Call onAnimationStart callback when animation begins
        if (onAnimationStart) {
          console.log('🚀 Animation starting - calling onAnimationStart callback');
          onAnimationStart();
        }
      }

      // Ensure we don't keep streaming if we already have all the content
      if (displayedText === fullContentRef.current) {
        setIsDone(true);
        return;
      }

      // Stream the text character by character
      clearStreamTimer(); // Clear any existing timer
      
      // For better streaming performance, increment by a larger amount for longer messages
      // Significantly increase base chars per tick for faster animation
      const baseCharsPerTick = 15;  // Increased from 5 to 15
      const additionalCharsPerTick = Math.floor(fullContentRef.current.length / 300);  // Reduced divisor to add more chars per tick
      const charsPerTick = baseCharsPerTick + additionalCharsPerTick;
      
      // Use a more adaptive timer duration for smoother streaming
      // Greatly reduce timer duration for faster text rendering
      const baseTimerDuration = 5;  // Reduced from 12 to 5
      const contentLength = fullContentRef.current.length;
      
      // Adjust timing based on content length with a maximum duration
      const timerDuration = Math.min(
        baseTimerDuration + Math.floor(contentLength / 10000),
        10  // Reduced maximum timer duration from 20 to 10
      );
      
      // Create a stable timer ID to prevent duplicate timers
      const timerId = `stream-${responseIdRef.current}-${Date.now()}`;
      console.log(`Creating stream timer ${timerId}, length: ${displayedText.length}/${fullContentRef.current.length}`);
      
      // Allow final messages to stream but mark them for special completion handling
      if (isFinalResponseContent(fullContentRef.current)) {
        console.log(`Final message detected - will stream with character animation and then complete properly`);
        hasFinalResponseRef.current = true;
        // Don't return here - let streaming continue
      }
      
      // Define a recursive streaming function that continues until text is fully displayed
      const streamNextChunk = () => {
        // ALWAYS check if we've reached the end of content - NEVER stop early based on final message detection
        // This ensures animations always complete to 100%
        if (displayedText.length >= fullContentRef.current.length) {
          
          console.log(`Streaming complete - reached 100% of content`);
          
          // Always make sure we show the entire content
          setDisplayedText(fullContentRef.current);
          setProcessedHtml(parseMarkdown(fullContentRef.current));
          setIsDone(true);
          
          // Notify parent of completion
          if (onAnimationComplete) {
            safeSetTimeout(() => onAnimationComplete(true), 10);
          }
          return;
        }
        
        // Safety check - if we're somehow called after we're done, don't continue
        if (isDone || displayedText.length >= fullContentRef.current.length) {
          console.log(`Stream timer ${timerId} aborted, already at end`);
          setIsDone(true);
          return;
        }
        
        // Calculate number of characters to add, with adjustments for final responses to speed up rendering
        let charsToAdd = charsPerTick;
        
        // If this is a final response, add more characters per tick the longer it gets to accelerate rendering
        if (hasFinalResponseRef.current || isFinalResponseContent(fullContentRef.current)) {
          // Add bonus characters for final responses (scaled to length)
          const bonusChars = Math.floor(fullContentRef.current.length / 200);
          // Increase characters added as the animation progresses to accelerate toward the end
          const progressBonus = Math.floor((displayedText.length / fullContentRef.current.length) * 20);
          
          // Add both bonuses to the base character count
          charsToAdd = charsPerTick + bonusChars + progressBonus;
          
          // For very long final responses, add even more characters per tick to finish quickly
          if (fullContentRef.current.length > 500) {
            charsToAdd += Math.floor(fullContentRef.current.length / 100);
          }
        } else {
          // For non-final responses, just add a small random factor
          charsToAdd += Math.floor(Math.random() * 4);
        }
        
        const nextTextLength = Math.min(displayedText.length + charsToAdd, fullContentRef.current.length);
        const nextText = fullContentRef.current.substring(0, nextTextLength);
        
        // For long final responses, check if we're near the end and jump to completion
        if ((hasFinalResponseRef.current || isFinalResponseContent(fullContentRef.current)) &&
            fullContentRef.current.length > 300 &&
            nextTextLength > fullContentRef.current.length * 0.8) {
          // If we've shown 80% of a long final response, complete it immediately
          console.log(`Final response is >80% complete (${nextTextLength}/${fullContentRef.current.length}) - accelerating to completion`);
          return streamTimerRef.current = safeSetTimeout(() => {
            setDisplayedText(fullContentRef.current);
            setProcessedHtml(parseMarkdown(fullContentRef.current));
            setIsDone(true);
            
            // Notify parent of completion
            if (onAnimationComplete) {
              onAnimationComplete(true);
            }
          }, 100);
        }
        
        // For final messages, continue streaming until completion rather than jumping ahead
        // This ensures the full character-by-character animation plays out
        
        // Only update if we're adding characters or this is the final chunk
        // This ensures we always render the complete content, even if it might match fullContentRef.current
        if (nextText.length > displayedText.length || nextTextLength >= fullContentRef.current.length) {
          setDisplayedText(nextText);
          setProcessedHtml(parseMarkdown(nextText));
          
          // Get the existing browser trace or create a new one
          const existingTrace = getAgentTrace('customer');
          
          // Create trace with both user message and streaming response
          const browserStreamingTrace: TraceGroup = {
            id: existingTrace?.id || `browser-trace-${Date.now()}`,
            type: 'trace-group' as const,
            sender: 'bot',
            dropdownTitle: 'Browser - Conversation',
            agentId: 'customer', // Browser node ID
            originalAgentType: 'Browser',
            tasks: [
              // Keep the existing user message task
              ...(existingTrace?.tasks?.filter(t => t.stepNumber === 1) || [{
                stepNumber: 1,
                title: `Step 1 - User Message (0.00 seconds)`,
                content: "User message",
                timestamp: Date.now() - 1000 // Ensure this appears first
              }]),
              // Add/update the response task
              {
                stepNumber: 2,
                title: `Step 2 - Response Streaming (${((Date.now() - 
                  parseAttributeAsNumber('.custom-agent-node[id="customer"]', 'data-start-time', Date.now())) / 1000).toFixed(2)} seconds)`,
                content: nextText,
                timestamp: Date.now()
              }
            ],
            text: "Conversation",
            startTime: existingTrace?.startTime || Date.now() - 1000,
            lastUpdateTime: Date.now()
          };
          
          // Store the updated browser trace
          storeAgentTrace('customer', browserStreamingTrace);
          
          // Update the browser node with streaming content
          const browserNodeUpdateEvent = new CustomEvent('agentNodeUpdate', {
            detail: {
              nodeId: 'customer',
              traceGroup: browserStreamingTrace,
              isStreaming: true
            }
          });
          document.dispatchEvent(browserNodeUpdateEvent);
          
    // Continue streaming with the next chunk - use safeSetTimeout to ensure proper tracking
    streamTimerRef.current = safeSetTimeout(streamNextChunk, timerDuration);
        } else if (nextText.length >= fullContentRef.current.length) {
          // We've reached the end of content - ensure full animation completion
          console.log(`Stream timer ${timerId} reached end of content`);
          
          // Clear the timer first to prevent any race conditions
          clearStreamTimer();
          
          // Set final state to ensure complete rendering
          setDisplayedText(fullContentRef.current);
          setProcessedHtml(parseMarkdown(fullContentRef.current));
          setIsDone(true);
          
          // Retrieve any existing browser trace to preserve user input
          const existingTrace = getAgentTrace('customer');
          
          // Final update to browser node with complete response
          const browserFinalTrace: TraceGroup = {
            id: `browser-trace-final-${Date.now()}`,
            type: 'trace-group' as const,
            sender: 'bot',
            dropdownTitle: 'Browser - Final Response',
            agentId: 'customer', // Browser node ID
            originalAgentType: 'Browser',
            tasks: [
              // Preserve any existing tasks like user input
              ...(existingTrace?.tasks?.filter(t => t.stepNumber === 1) || []),
              // Add final response task
              {
                stepNumber: 2,
                title: `Step 2 - Final Response (${((Date.now() - 
                parseAttributeAsNumber('.custom-agent-node[id="customer"]', 'data-start-time', Date.now())) / 1000).toFixed(2)} seconds)`,
                content: fullContentRef.current,
                timestamp: Date.now()
              }
            ],
            text: "Final response",
            startTime: existingTrace?.startTime || parseAttributeAsNumber('.custom-agent-node[id="customer"]', 'data-start-time', Date.now()),
            lastUpdateTime: Date.now(),
            isComplete: true
          };
          
          // Store the final browser trace - CRITICAL: ensure it's saved before kill switch
          storeAgentTrace('customer', browserFinalTrace);
          
          // Check if this was a final message that just finished streaming
          const wasFinalMessage = hasFinalResponseRef.current || isFinalResponseContent(fullContentRef.current);
          
          if (wasFinalMessage) {
            console.log('🎬 Final message streaming animation completed - dispatching completion events');
            
            // PHASE 1: Dispatch final message detected event
            dispatchFinalMessageDetected(fullContentRef.current);
            
        // PHASE 2: Schedule final rendered event with minimal delay for proper sequencing
        // Use Promise.resolve for microtask queue execution (faster than setTimeout)
        Promise.resolve().then(() => {
          if (fullContentRef.current === content) {
            console.log('🏁 Final message animation complete, dispatching final rendered event');
            dispatchFinalMessageRendered(fullContentRef.current);
          }
        });
          }
          
          // Update browser node with final content
          const browserNodeUpdateEvent = new CustomEvent('agentNodeUpdate', {
            detail: {
              nodeId: 'customer',
              traceGroup: browserFinalTrace,
              isComplete: true
            }
          });
          document.dispatchEvent(browserNodeUpdateEvent);
          
          // Notify parent of completion
          if (onAnimationComplete) {
            safeSetTimeout(() => onAnimationComplete(true), 10);
          }
        }
      };
      
      // Start the streaming process
      streamTimerRef.current = safeSetTimeout(streamNextChunk, timerDuration);

      return clearStreamTimer;
    }, [displayedText, isDone, content, onAnimationComplete]);

    // Define CSS for blinking cursor with fixed properties to prevent re-renders
    const cursorStyle = React.useMemo(() => ({
      display: 'inline-block',
      width: '2px',
      height: '14px',
      backgroundColor: '#4299E1',
      verticalAlign: 'middle',
      marginLeft: '1px',
      animation: 'blinkCursor 1s infinite',
      animationTimingFunction: 'steps(2, start)'
    }), []);

    // Add global style for the blinking cursor animation if it doesn't exist
    useEffect(() => {
      if (!document.getElementById('animation-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'animation-styles';
        styleEl.innerHTML = `
          @keyframes blinkCursor {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          
          /* Ensure all message content stays within bounds */
          .processed-message, .plain-text-message, .fallback-content {
            max-width: 100%;
            overflow-wrap: break-word;
            word-wrap: break-word;
            word-break: break-word;
            white-space: pre-wrap;
          }
          
          .markdown-content h1, .markdown-content h2, .markdown-content h3 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            color: #2C5282;
            overflow-wrap: break-word;
            word-break: break-word;
            max-width: 100%;
          }
          
          .markdown-content ul, .markdown-content ol {
            margin-left: 1.5em;
            margin-bottom: 0.5em;
            max-width: 100%;
          }
          
          .markdown-content li {
            margin-bottom: 0.25em;
            overflow-wrap: break-word;
            word-break: break-word;
          }
          
          .markdown-content p {
            margin-bottom: 0.75em;
            overflow-wrap: break-word;
            word-break: break-word;
            max-width: 100%;
          }
          
          .markdown-content strong {
            font-weight: 600;
            color: #1A365D;
          }
          
          .markdown-content em {
            font-style: italic;
            color: #2D3748;
          }
          
          .markdown-content a {
            color: #3182CE;
            text-decoration: underline;
            cursor: pointer;
            word-break: break-all;
            max-width: 100%;
            display: inline-block;
          }
          
          /* Ensure all message elements are constrained */
          .final-message * {
            max-width: 100%;
            overflow-wrap: break-word;
          }
        `;
        document.head.appendChild(styleEl);

        return () => {
          const element = document.getElementById('animation-styles');
          if (element) element.remove();
        };
      }
    }, []);

    // Memoize the container style with improved text wrapping
    const containerStyle = React.useMemo(() => ({
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 'inherit',
      lineHeight: '1.5',
      color: '#2D3748',
      overflowWrap: 'break-word' as 'break-word',
      wordWrap: 'break-word' as 'break-word',
      wordBreak: 'break-word' as 'break-word',
      maxWidth: '100%',
      whiteSpace: 'pre-wrap' as 'pre-wrap'
    }), []);
    
    // Style for processed message containers
    const processedMessageStyle = React.useMemo(() => ({
      overflowWrap: 'break-word' as 'break-word', 
      wordBreak: 'break-word' as 'break-word',
      maxWidth: '100%'
    }), []);
    
    // Reference to track if we've previously rendered any final messages
    const hasPreviouslyRenderedFinalMessage = useRef(false);

    // Allow all messages to render through normal streaming process
    // Final messages will be handled by the streaming completion logic
    
    // Simplified rendering with multiple fallbacks
    return (
      <div style={containerStyle} className={isFinalResponseContent(content) ? "final-message" : ""}>
        {/* Debug info */}
        <div style={{ display: 'none' }}>
          {`msgId=${messageId}, content=${!!content}(${content?.length}), displayedText=${!!displayedText}(${displayedText?.length}), html=${!!processedHtml}(${processedHtml?.length})`}
        </div>
        
        {/* First priority: show processedHTML if available */}
        {processedHtml ? (
          <div className="processed-message" style={processedMessageStyle}>
            <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
            {!isDone && <span style={cursorStyle}></span>}
          </div>
        ) : 
        /* Second priority: displayedText */
        displayedText ? (
          <div className="plain-text-message" style={processedMessageStyle}>
            {displayedText}
            {!isDone && <span style={cursorStyle}></span>}
          </div>
        ) : 
        /* Third priority: direct content prop */
        content ? (
          <div className="fallback-content" style={processedMessageStyle}>
            {content}
            {!isDone && <span style={cursorStyle}></span>}
          </div>
        ) : 
        /* Last resort: loading message */
        (
          <div>Loading response...</div>
        )}
      </div>
    );
  },
  // Greatly simplified equality function to ensure complete message rendering
  (prevProps, nextProps) => {
    // For improved reliability, ALWAYS re-render when content changes
    if (prevProps.content !== nextProps.content) {
      console.log("Content changed, forcing render");
      return false; // Content changed, force re-render
    }
    
    // Check if message IDs are different - always re-render for new messages
    if (prevProps.messageId !== nextProps.messageId) {
      console.log("Message ID changed, forcing render");
      return false; // Message ID changed, force re-render
    }
    
    // Only skip re-renders if props are completely identical
    return true;
  }
);

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

// Helper function to determine if a text or trace data indicates a final response
export const isFinalResponseContent = (content: string, traceData?: any): boolean => {
  // First use the comprehensive detection from finalMessageKillSwitch
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
      "Please let me know if you need any clarification"
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
}

// Debug console log for animation state
const debugAnimationState = (id: string, status: string) => {
  console.log(`🎬 ANIMATION ${status}: ${id} at ${Date.now()}`);
};

// Use memo with custom equality function to prevent unnecessary re-renders
export const FinalMessageStreaming = React.memo(
  ({ content, onAnimationStart, onAnimationComplete, messageId }: FinalMessageStreamingProps) => {
    // Calculate initial state values
    const isGreeting = content === "Hello, how can I assist you?";
    const isFinal = content && typeof content === 'string' && isFinalResponseContent(content);
    
  // For final messages and product recommendations, skip animation entirely
  // Set the initial state based on whether this is a final message
  const shouldSkipAnimation = isGreeting || isFinal;
  const initialContent = shouldSkipAnimation ? content : '';
  const initialHtml = shouldSkipAnimation ? parseMarkdown(content) : '';
  
  // Set states with immediate content for final messages
  const [displayedText, setDisplayedText] = useState(initialContent);
  const [processedHtml, setProcessedHtml] = useState(initialHtml);
  // Start with isDone true for final messages and greetings
  const [isDone, setIsDone] = useState(shouldSkipAnimation);

    // Debug component initialization
    console.log(`Component initialized: msgId=${messageId}, content=${!!content}(${content?.length || 0}), html=${!!processedHtml}, isDone=${isDone}`);

    // Modified effect to support streaming behavior with localStorage backup
    useEffect(() => {
      if (content) {
        console.log(`Content change detected (${content.length} chars), msgId=${messageId}`);
        
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
        
        // Only set full content immediately for greetings and final messages
        // This allows other messages to stream properly
        const isGreeting = completeContent === "Hello, how can I assist you?";
        const isFinal = completeContent && typeof completeContent === 'string' && isFinalResponseContent(completeContent);
        
        if (isGreeting) {
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
    useEffect(() => {
      // Check if this contains final message phrases
      const hasFinalPhrases = isFinalResponseContent(fullContentRef.current);
      
      if (hasFinalPhrases) {
        console.log('🔒 Final message detected, activating animation lock for protection');
        allowInterruptRef.current = false;
      }
    }, [fullContentRef.current]);
    
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
      const baseCharsPerTick = 5;
      const additionalCharsPerTick = Math.floor(fullContentRef.current.length / 500);
      const charsPerTick = baseCharsPerTick + additionalCharsPerTick;
      
      // Use a more adaptive timer duration for smoother streaming
      // Shorter for small content, slightly longer for large content
      const baseTimerDuration = 12;
      const contentLength = fullContentRef.current.length;
      
      // Adjust timing based on content length with a maximum duration
      const timerDuration = Math.min(
        baseTimerDuration + Math.floor(contentLength / 5000),
        20 // Maximum timer duration
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
        // First check if we've reached the end of content or the streaming should complete
        if (displayedText.length >= fullContentRef.current.length || 
           (isFinalResponseContent(fullContentRef.current) && displayedText.length > fullContentRef.current.length * 0.7)) {
          
          console.log(`Streaming complete - reached end of content or detected final message`);
          
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
        
        // Add a constant but random number of characters each time for a more natural effect
        // Using a consistent algorithm reduces render jitter
        const charsToAdd = Math.floor(Math.random() * 4) + charsPerTick;
        const nextTextLength = Math.min(displayedText.length + charsToAdd, fullContentRef.current.length);
        const nextText = fullContentRef.current.substring(0, nextTextLength);
        
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
            
            // PHASE 2: Schedule final rendered event with small delay for proper sequencing
            safeSetTimeout(() => {
              if (fullContentRef.current === content) {
                console.log('🏁 Final message animation complete, dispatching final rendered event');
                dispatchFinalMessageRendered(fullContentRef.current);
              }
            }, 200);
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
  // Enhanced custom equality function to ensure proper streaming behavior
  (prevProps, nextProps) => {
    // Check if next props contain more content than previous
    const nextLonger = (nextProps.content?.length || 0) > (prevProps.content?.length || 0);
    
    // Check for final message indicators in either current or new content
    const nextContentHasFinalMarkers = isFinalResponseContent(nextProps.content);
    const prevContentHasFinalMarkers = isFinalResponseContent(prevProps.content);
    
    // If the new content contains final markers but the old didn't, always re-render
    if (nextContentHasFinalMarkers && !prevContentHasFinalMarkers) {
      console.log("Final message detected in equality check, forcing render");
      return false; // Force re-render
    }
    
    // Always check for phrases that might indicate a final response
    if (nextProps.content) {
      const finalPhrases = [
        "Can I help you with anything else?",
        "Is there anything else",
        "In conclusion",
        "To summarize",
        "I hope this helps",
        "Let me know if you have any questions"
      ];
      
      // Product-specific phrases that should trigger re-rendering
      const productSpecificPhrases = [
        "Recommended Products:",
        "Troubleshooting Tips:",
        "ThunderBolt Speaker",
        "SonicWave Bluetooth Speaker"
      ];
      
      // Check for product-specific phrases in next content
      const hasProductPattern = productSpecificPhrases.some(phrase => 
        nextProps.content.includes(phrase)
      );
      
      // Force re-render for products even if length difference is small
      if (hasProductPattern) {
        console.log("Product-related content detected in memo check, forcing render");
        return false; // Force re-render
      }
      
      // If any of these phrases appear in the new content but weren't in the old, force render
      for (const phrase of finalPhrases) {
        if (nextProps.content.includes(phrase) && (!prevProps.content || !prevProps.content.includes(phrase))) {
          console.log(`Final phrase "${phrase}" detected, forcing render`);
          return false; // Force re-render
        }
      }
    }
    
    // Always allow renders for new messages (first time appearing)
    if (!prevProps.messageId && nextProps.messageId) {
      console.log("New message with ID detected, forcing render");
      return false;
    }
    
    // Always render if message IDs are different
    if (prevProps.messageId !== nextProps.messageId) {
      console.log("Message ID changed, forcing render");
      return false;
    }
    
    // If contents are identical, we can skip rendering
    if (prevProps.content === nextProps.content) {
      return true;
    }
    
    // For updates that make the content longer, be more aggressive about re-rendering
    if (nextLonger) {
      const lengthDiff = (nextProps.content?.length || 0) - (prevProps.content?.length || 0);
      // More frequent updates for growing content
      if (lengthDiff > 5) {
        console.log(`Content grew by ${lengthDiff} chars, allowing re-render`);
        return false; 
      }
    }
    
    // For non-final responses, check content length difference
    const lengthDiff = Math.abs((prevProps.content?.length || 0) - (nextProps.content?.length || 0));
    
    // Always render if it's a significant change
    if (lengthDiff > 8) { // Lower threshold further to ensure more updates
      console.log(`Significant change in content length: ${lengthDiff}, allowing re-render`);
      return false;
    }
    
    // Default case - still allow re-renders more often
    return lengthDiff < 2; // Only skip tiny updates (lower threshold)
  }
);

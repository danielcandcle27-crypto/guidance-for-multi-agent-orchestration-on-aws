import { useEffect, useRef } from 'react';
import { TraceGroup, TraceState } from '../../../utilities/traceParser';

// Extend Window interface for debug flags
declare global {
  interface Window {
    __traceDebugMode?: boolean;
  }
}

/**
 * Custom hook to handle trace timer updates with proper cleanup and completion detection
 * This implementation fixes the continuous process issue by ensuring proper interval cleanup
 */
export const useTraceTimer = (
  showTrace: boolean, 
  traceState: TraceState, 
  setTraceState: React.Dispatch<React.SetStateAction<TraceState>>
) => {
  // Use refs to maintain state across renders and prevent stale closures
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const allTracesCompleteRef = useRef(false);
  const updateCountRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const MAX_UPDATES = 300; // Stop updating after ~5 minutes
  const MIN_UPDATE_INTERVAL = 2000; // Only update every 2 seconds to reduce re-renders

  // Add event listener for force-stopping all timers
  useEffect(() => {
    const forceCleanup = () => {
      if (import.meta.env.DEV && window.__traceDebugMode) {
        console.log('🧹 Force cleanup of all trace timers triggered by external event');
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        isProcessingRef.current = false;
      }
      // Mark the state as completed immediately to avoid re-starting timers
      allTracesCompleteRef.current = true;
    };
    
    document.addEventListener('clearAllTimers', forceCleanup);
    return () => document.removeEventListener('clearAllTimers', forceCleanup);
  }, []);
  
  // Add live updating of trace timers with better stop logic
  useEffect(() => {
    // Don't start a new timer if we're already processing to prevent duplicates
    if (isProcessingRef.current) {
      if (import.meta.env.DEV && window.__traceDebugMode) {
        console.log('Trace timer update already in progress, not starting a new one');
      }
      return;
    }

    // Clear any existing timer when dependencies change
    if (timerIntervalRef.current) {
      if (import.meta.env.DEV && window.__traceDebugMode) {
        console.log('Clearing previous timer interval');
      }
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Reset counter and complete flag when trace state changes
    updateCountRef.current = 0;
    allTracesCompleteRef.current = false;

    // Only set up the timer if we have trace groups and they're visible
    if (!showTrace || traceState.messages.length === 0) {
      return;
    }

    // Check if we have any incomplete trace groups
    const incompleteTraceGroups = traceState.messages.filter(msg => 
    msg.type === 'trace-group' && 
    !(msg as TraceGroup).isComplete
    );
    
    // Don't start a timer if all traces are already complete
    if (incompleteTraceGroups.length === 0) {
      allTracesCompleteRef.current = true;
      if (import.meta.env.DEV && window.__traceDebugMode) {
        console.log('All trace groups are already complete, not starting timer');
      }
      return;
    }
    
    if (import.meta.env.DEV && window.__traceDebugMode) {
      console.log('Starting trace timer update interval');
    }
    isProcessingRef.current = true;
    
    // Performance optimization: Update less frequently and with throttling
    timerIntervalRef.current = setInterval(() => {
      // Safety check - stop updating after MAX_UPDATES
      if (updateCountRef.current > MAX_UPDATES) {
        if (import.meta.env.DEV && window.__traceDebugMode) {
          console.log('Reached max timer updates, stopping interval');
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          isProcessingRef.current = false;
        }
        return;
      }
      
      // Throttle updates to prevent excessive re-renders
      const now = Date.now();
      if (now - lastUpdateTimeRef.current < MIN_UPDATE_INTERVAL) {
        return;
      }
      lastUpdateTimeRef.current = now;
      
      updateCountRef.current += 1;
      
      // Check if all traces are marked complete - use a function for checking
      const checkAllComplete = (state: TraceState) => state.messages.every(msg => 
        msg.type !== 'trace-group' || // Not a trace group
        (msg as TraceGroup).isComplete // Or is already complete
      );
      
      // Store the result for the next check
      allTracesCompleteRef.current = checkAllComplete(traceState);
      
      if (import.meta.env.DEV && window.__traceDebugMode) {
        console.log('🔍 TIMER DEBUG: Trace completion check:', 
          allTracesCompleteRef.current ? 'All traces complete!' : 'Some traces still running', 
          'Running for', updateCountRef.current, 'updates');
      }
      
      if (allTracesCompleteRef.current) {
        if (import.meta.env.DEV && window.__traceDebugMode) {
          console.log('🛑 All trace groups are complete, stopping interval');
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          isProcessingRef.current = false;
        }
        return;
      }
      
      setTraceState(prevState => {
        // Only update if we have trace groups that are not complete
        if (checkAllComplete(prevState)) {
          return prevState; // No changes needed
        }

        // Performance optimization: Use shallow copying instead of deep JSON parse
        const currentTimestamp = Date.now();
        let hasUpdates = false;
        const updatedMessages: any[] = [];
        
        // Performance optimization: Update only changed trace groups
        prevState.messages.forEach(msg => {
          if (msg.type === 'trace-group') {
            // Safe cast since we already checked type
            const traceGroup = msg as TraceGroup;
            
            // Skip if already marked complete
            if (traceGroup.isComplete) {
              updatedMessages.push(traceGroup);
              return;
            }
            
            // Check if this trace group has a completed final response
            const hasFinalResponse = 'tasks' in traceGroup && traceGroup.tasks && traceGroup.tasks.some(task => 
              task.title.includes("Final Response") || 
              (task.content && typeof task.content === 'string' && 
                (task.content.includes("Can I help you with anything else?") ||
                task.content.includes("Is there anything else") || 
                task.content.includes("In conclusion") ||
                task.content.includes("To summarize")))
            );
            
            // Only update active trace groups that don't have final responses
            if (!hasFinalResponse) {
              // Performance optimization: Calculate timing less frequently
              const timeDiff = currentTimestamp - traceGroup.startTime;
              
              // Only update every few seconds for better performance
              if (timeDiff % 3000 < 1000) { // Update roughly every 3 seconds
                const totalElapsedTime = (timeDiff / 1000).toFixed(2);
                
                // Count regular tasks (non-special)
                const regularTaskCount = 'tasks' in traceGroup && traceGroup.tasks ? 
                  traceGroup.tasks.filter(t => t.stepNumber > 0).length : 0;
                
                // Extract base title (remove timing info)
                const baseTitleParts = traceGroup.dropdownTitle.split('(');
                if (baseTitleParts.length > 0) {
                  const baseTitle = baseTitleParts[0].trim();
                  
                  // Update the dropdown title with current timing
                  const newTitle = `${baseTitle} (${totalElapsedTime} seconds, ${regularTaskCount} steps)`;
                  
                  // Only update if changed
                  if (traceGroup.dropdownTitle !== newTitle) {
                    const updatedGroup = { ...traceGroup, dropdownTitle: newTitle };
                    updatedMessages.push(updatedGroup);
                    hasUpdates = true;
                    return;
                  }
                }
              }
              updatedMessages.push(traceGroup);
            } else if (!traceGroup.isComplete) {
              // Mark this trace group as complete so we don't update it anymore
              if (import.meta.env.DEV && window.__traceDebugMode) {
                console.log(`Marking trace group ${traceGroup.agentId || 'unknown'} as complete`);
              }
              
              // Performance optimization: Create completed group in one operation
              const baseTitleParts = traceGroup.dropdownTitle.split('(');
              let finalTitle = traceGroup.dropdownTitle;
              
              if (baseTitleParts.length > 0) {
                const baseTitle = baseTitleParts[0].trim();
                const timeMatch = traceGroup.dropdownTitle.match(/\(([\d.]+) seconds/);
                const elapsedTime = timeMatch ? timeMatch[1] : "0.00";
                
                const regularTaskCount = 'tasks' in traceGroup && traceGroup.tasks ? 
                  traceGroup.tasks.filter(t => t.stepNumber > 0).length : 0;
                
                finalTitle = `${baseTitle} (${elapsedTime}s total, ${regularTaskCount} steps)`;
              }
              
              const completedGroup = {
                ...traceGroup,
                isComplete: true,
                dropdownTitle: finalTitle
              };
              
              updatedMessages.push(completedGroup);
              hasUpdates = true;
            } else {
              updatedMessages.push(traceGroup);
            }
          } else {
            updatedMessages.push(msg);
          }
        });
        
        // Only return new state if we actually made changes
        return hasUpdates ? {
          ...prevState,
          messages: updatedMessages
        } : prevState;
      });
    }, 2000); // Update every 2 seconds instead of every second
    
    // Clean up interval when component unmounts or dependencies change
    return () => {
      if (timerIntervalRef.current) {
        if (import.meta.env.DEV && window.__traceDebugMode) {
          console.log('Cleaning up timer interval on effect cleanup');
        }
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        isProcessingRef.current = false;
      }
    };
  }, [showTrace, traceState.messages.length]);
};

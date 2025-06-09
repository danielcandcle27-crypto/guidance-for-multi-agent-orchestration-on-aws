import React, { useEffect, useState, useId, useRef } from 'react';
import { Spinner } from "@cloudscape-design/components";
import Box from "@cloudscape-design/components/box";
import { TraceGroup as TraceGroupType } from '../../../utilities/traceParser';
import { getSafeTraceGroups, getNewestTraceGroup } from '../../../utilities/safeTraceUtils';

// Extend Window interface for debug flags
declare global {
  interface Window {
    __chatDebugMode?: boolean;
  }
}

interface ActivityStatusLoaderProps {
  traceState: any;
  isLoading: boolean;
  responseId?: string | null;
}

// Generate a singleton ID to ensure only one loader renders
const SINGLETON_ID = Math.random().toString(36).substring(2, 9);

/**
 * A component that displays a loading spinner with the latest agent activity
 * Updates continuously as new trace data is received
 */
const ActivityStatusLoader: React.FC<ActivityStatusLoaderProps> = ({ traceState, isLoading, responseId }) => {
  const uniqueId = useId(); // Generate a unique ID for this instance
  const instanceId = useRef(`loader-${SINGLETON_ID}-${Date.now()}`);
  const [statusText, setStatusText] = useState("Analyzing your question and preparing a response...");
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [mountTime] = useState(Date.now()); // Track when this component was mounted
  const lastStatusRef = useRef<string>("");

  // Store the last 5 trace titles to detect new content
  const recentTitlesRef = useRef<string[]>([]);

  useEffect(() => {
    // Update the status text based on the latest trace activity
    if (!isLoading) return;

    // Log when the loader is activated (debug mode only)
    if (import.meta.env.DEV && window.__chatDebugMode) {
      console.log(`🔄 Activity loader ${instanceId.current} activated at ${new Date(mountTime).toLocaleTimeString()}`);
    }

    // Force update more frequently (every 100ms) to keep up with trace updates
    // This makes the loader much more responsive to changes
    const updateTimer = setInterval(() => {
      // Get current activity status to ensure animations continue
      const currentStatus = getActivityStatus();
      
      // Only update state if the status changed to avoid unnecessary renders
      if (currentStatus !== lastStatusRef.current) {
        setStatusText(currentStatus);
        lastStatusRef.current = currentStatus;
        setLastUpdated(Date.now());
        if (import.meta.env.DEV && window.__chatDebugMode) {
          console.log(`🔄 Status updated: ${currentStatus}`);
        }
      }
    }, 100); // Much more frequent updates

    // Setup mutation observer to watch for trace group updates in real-time
    const traceObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // Force status update whenever the DOM changes in trace groups
          const currentStatus = getActivityStatus();
          if (currentStatus !== lastStatusRef.current) {
            setStatusText(currentStatus);
            lastStatusRef.current = currentStatus;
            setLastUpdated(Date.now());
          }
        }
      }
    });
    
    // Observe the trace container if it exists
    const traceContainers = document.querySelectorAll('.trace-group');
    if (traceContainers.length > 0) {
      traceContainers.forEach(container => {
        traceObserver.observe(container, { 
          childList: true, 
          subtree: true,
          characterData: true 
        });
      });
    }

    // Set up a document-level event listener for reactivating animations
    const handleReactivate = () => {
      if (import.meta.env.DEV && window.__chatDebugMode) {
        console.log('♻️ Reactivating activity animations');
      }
      setLastUpdated(Date.now());
      
      // Get fresh status when reactivated
      const currentStatus = getActivityStatus();
      setStatusText(currentStatus);
      lastStatusRef.current = currentStatus;
    };
    
    document.addEventListener('reactivateAnimations', handleReactivate);
    
    // Set up safety timer to remove loader after 30 seconds
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        if (import.meta.env.DEV && window.__chatDebugMode) {
          console.log('⚠️ Safety timeout reached for loader - activity should have completed');
        }
        document.dispatchEvent(new CustomEvent('forceCompleteTextContent', {
          detail: { source: 'safety_timeout', responseId }
        }));
      }
    }, 30000);

    // Cleanup
    return () => {
      clearInterval(updateTimer);
      clearTimeout(safetyTimer);
      document.removeEventListener('reactivateAnimations', handleReactivate);
      traceObserver.disconnect();
      if (import.meta.env.DEV && window.__chatDebugMode) {
        console.log(`🛑 Activity loader ${instanceId.current} deactivated`);
      }
    };
  }, [isLoading, responseId, mountTime]);

  const getActivityStatus = () => {
    if (!traceState?.messages?.length) {
      return "Analyzing your question and preparing a response...";
    }

    // Use our type-safe utility to get the newest trace group
    const latestGroup = getNewestTraceGroup(traceState.messages);
    
    if (!latestGroup) {
      return "Processing your request...";
    }
    
    // Get the latest task from the group
    const tasks = latestGroup.tasks || [];
    const latestTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
    
    // Format agent name nicely
    const agentName = latestGroup.originalAgentType || latestGroup.dropdownTitle?.split(' ')[0] || 'Agent';
    
      // If we have a task, show agent -> task info
      if (latestTask) {
        // Check if this is a final response task but don't freeze the display
        const isFinalResponse = 
            latestTask.title.includes("Final Response") ||
            (latestTask.content && typeof latestTask.content === 'string' && 
            (latestTask.content.includes("Can I help you with anything else?") ||
             latestTask.content.includes("Is there anything else") ||
             latestTask.content.includes("In conclusion") ||
             latestTask.content.includes("To summarize")));
        
        // Don't replace with generic message - continue showing actual task info
        // This prevents the dynamic display from appearing to freeze
      
      // Extract step number if present
      const stepMatch = latestTask.title.match(/Step (\d+(?:\.\d+)?)/);
      const stepInfo = stepMatch ? stepMatch[0] : '';
      
      // Create a more readable task description
      let taskDesc = latestTask.title
          .replace(/Step \d+(?:\.\d+)?/, '')  // Remove step number
          .replace(/\([^)]*\)/g, '')          // Remove anything in parentheses
          .trim();
          
      // If task description is too long, truncate it
      if (taskDesc.length > 40) {
          taskDesc = taskDesc.substring(0, 37) + '...';
      }
      
      return `${agentName} → ${stepInfo}${stepInfo ? ': ' : ''}${taskDesc}`;
    }
                                        
    // Fallback if no specific task info is available
    return `${agentName} → Processing...`;
  };

  if (!isLoading) return null;

  return (
    <Box padding="s" textAlign="center" margin={{ top: "l" }}>
      <Spinner size="normal" />
      <Box padding="s" color="text-status-inactive" fontSize="body-s">
        {getActivityStatus()}
        <div style={{ fontSize: '0px', opacity: 0 }}>{lastUpdated}</div>
      </Box>
    </Box>
  );
};

export default ActivityStatusLoader;

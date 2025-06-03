/**
 * Agent Trace Storage
 * 
 * This utility manages persistent storage of agent trace data
 * and provides methods to access and update it.
 * 
 * It also includes helper functions for consistent trace data formatting
 * across different display contexts (chat window, agent flow diagram).
 */

import { TraceGroup, Task } from './traceParser';

// Define the interface for agent trace data stored in local storage
interface AgentTraceCache {
  [nodeId: string]: {
    traces: {
      [traceId: string]: {
        traceGroup: TraceGroup;
        lastUpdated: number;
      }
    };
    lastUpdated: number;
  };
}

// Keys for local storage
const TRACE_STORAGE_KEY = 'agent-trace-cache';
const SESSION_TRACE_KEY = 'current-session-traces';

// Constants for storage management
const MAX_TRACE_AGE_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const IDLE_CLEANUP_THRESHOLD_MS = 30 * 1000; // 30 seconds
const ESTIMATED_MAX_STORAGE_BYTES = 4 * 1024 * 1024; // ~4MB safe limit
const CLEANUP_QUOTA_THRESHOLD = 0.8; // Clean when at 80% of quota

// Track last cleanup time to prevent too frequent cleanups
let lastCleanupTime = 0;
// Flag to track if trace cleanup is in progress to prevent recursive calls
let cleanupInProgress = false;

/**
 * Initialize the agent trace storage, clearing existing data on page load/reload
 */
export const initAgentTraceStorage = (): void => {
  // Clear all existing storage on page load/reload to prevent stale data
  localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify({}));
  sessionStorage.setItem(SESSION_TRACE_KEY, JSON.stringify({}));
  
  // Reset the in-memory cache
  window.__agentTraceCache = {};
  
  // Initialize cleanup timers
  setupPeriodicCleanup();
  
  console.log('🧹 Agent trace storage cleared on page load/reload');
};

/**
 * Set up periodic cleanup of trace data to prevent quota issues
 */
const setupPeriodicCleanup = (): void => {
  // Don't set up multiple cleanup timers
  if (window.__traceCleanupTimerActive) {
    return;
  }

  // Set a cleanup timer that runs periodically
  const timer = setInterval(() => {
    // Only run cleanup if not already in progress
    if (!cleanupInProgress) {
      cleanupOldTraces();
    }
  }, CLEANUP_INTERVAL_MS);
  
  // Mark cleanup as active and store timer reference for cleanup
  window.__traceCleanupTimerActive = true;
  window.__traceCleanupTimer = timer;
  
  // Clean up the timer when the window is closed/refreshed
  window.addEventListener('beforeunload', () => {
    if (window.__traceCleanupTimer) {
      clearInterval(window.__traceCleanupTimer);
      window.__traceCleanupTimerActive = false;
    }
  });

  // Also set up idle time detection for cleanup
  setupIdleCleanup();
};

/**
 * Set up cleanup during user idle time
 */
const setupIdleCleanup = (): void => {
  // Track user activity
  let lastActivityTime = Date.now();
  const trackActivity = () => {
    lastActivityTime = Date.now();
  };
  
  // Add basic activity listeners
  ['mousemove', 'keypress', 'scroll', 'click'].forEach(eventName => {
    window.addEventListener(eventName, trackActivity, { passive: true });
  });
  
  // Check for idle state periodically
  const idleTimer = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime;
    if (idleTime > IDLE_CLEANUP_THRESHOLD_MS && !cleanupInProgress) {
      // User is idle - good time to clean up
      console.log(`🕒 User idle for ${Math.round(idleTime/1000)}s - running cleanup`);
      cleanupAllButCurrentSession();
    }
  }, IDLE_CLEANUP_THRESHOLD_MS);
  
  // Store timer reference for cleanup
  window.__traceIdleCleanupTimer = idleTimer;
  
  // Clean up the timer when the window is closed/refreshed
  window.addEventListener('beforeunload', () => {
    if (window.__traceIdleCleanupTimer) {
      clearInterval(window.__traceIdleCleanupTimer);
    }
  });
};

// Add type declaration for global trace data storage
declare global {
  interface Window {
    __agentTraceCache?: AgentTraceCache;
    __lastTraceEventHash?: string;
    __traceCleanupTimerActive?: boolean;
    __traceCleanupTimer?: ReturnType<typeof setInterval>;
    __traceIdleCleanupTimer?: ReturnType<typeof setInterval>;
    __currentSessionId?: string;
  }
}

/**
 * Clean up old trace data to prevent quota issues
 * Removes trace data older than MAX_TRACE_AGE_MS
 */
const cleanupOldTraces = (): void => {
  // Set flag to prevent recursive calls
  cleanupInProgress = true;
  const now = Date.now();
  
  // Don't clean up too frequently
  if (now - lastCleanupTime < 15000) { // 15 seconds minimum between cleanups
    cleanupInProgress = false;
    return;
  }
  
  console.log('🧹 Running trace cleanup for old traces');
  
  try {
    // Clean up localStorage
    const cachedData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
    let modified = false;
    const cutoffTime = now - MAX_TRACE_AGE_MS;
    
    // Check each node
    Object.keys(cachedData).forEach(nodeId => {
      if (cachedData[nodeId] && cachedData[nodeId].traces) {
        const traces = cachedData[nodeId].traces;
        const traceIds = Object.keys(traces);
        
        // Filter out old traces
        const oldTraceIds = traceIds.filter(id => traces[id].lastUpdated < cutoffTime);
        if (oldTraceIds.length > 0) {
          oldTraceIds.forEach(id => {
            delete traces[id];
            modified = true;
          });
          
          console.log(`🗑️ Removed ${oldTraceIds.length} old traces for ${nodeId}`);
        }
      }
    });
    
    // Save changes if any were made
    if (modified) {
      localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(cachedData));
    }
    
    // Also clean up session storage
    const sessionData = JSON.parse(sessionStorage.getItem(SESSION_TRACE_KEY) || '{}');
    modified = false;
    
    // Remove old sessions and traces
    Object.keys(sessionData).forEach(sessionId => {
      const session = sessionData[sessionId];
      let sessionModified = false;
      
      // Check each node in this session
      Object.keys(session).forEach(nodeId => {
        if (session[nodeId] && session[nodeId].traces) {
          const traces = session[nodeId].traces;
          const traceIds = Object.keys(traces);
          
          // Filter out old traces
          const oldTraceIds = traceIds.filter(id => traces[id].lastUpdated < cutoffTime);
          if (oldTraceIds.length > 0) {
            oldTraceIds.forEach(id => {
              delete traces[id];
              modified = true;
              sessionModified = true;
            });
          }
        }
      });
      
      // If the session now has no traces, remove it entirely
      if (sessionModified) {
        let hasTraces = false;
        Object.keys(session).forEach(nodeId => {
          if (session[nodeId]?.traces && Object.keys(session[nodeId].traces).length > 0) {
            hasTraces = true;
          }
        });
        
        if (!hasTraces) {
          delete sessionData[sessionId];
          console.log(`🗑️ Removed empty session ${sessionId}`);
          modified = true;
        }
      }
    });
    
    // Save changes if any were made
    if (modified) {
      sessionStorage.setItem(SESSION_TRACE_KEY, JSON.stringify(sessionData));
    }
    
    // Update memory cache to match localStorage
    window.__agentTraceCache = cachedData;
    
  } catch (error) {
    console.error('Error during trace cleanup:', error);
  }
  
  // Update last cleanup time
  lastCleanupTime = now;
  cleanupInProgress = false;
};

/**
 * Clean up all trace data except for the current session
 * This is used by the chat component to clean up traces after sending a message
 */
export function cleanupAllButCurrentSession(): void {
  // Set flag to prevent recursive calls
  cleanupInProgress = true;
  console.log('🧹 Running cleanup - preserving only current session data');
  
  try {
    // Get current session ID
    const currentSessionId = window.__currentSessionId;
    if (!currentSessionId) {
      console.log('No current session ID found - skipping cleanup');
      cleanupInProgress = false;
      return;
    }
    
    // Clean localStorage - keep only traces from current session
    const cachedData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
    const nodesToKeep = {};
    
    // Only keep nodes from the current session
    Object.keys(cachedData).forEach(nodeId => {
      if (cachedData[nodeId].sessionId === currentSessionId) {
        nodesToKeep[nodeId] = cachedData[nodeId];
      }
    });
    
    // Save reduced data
    localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(nodesToKeep));
    
    // Clean sessionStorage - keep only current session
    const sessionData = JSON.parse(sessionStorage.getItem(SESSION_TRACE_KEY) || '{}');
    if (sessionData[currentSessionId]) {
      const reducedSessionData = { [currentSessionId]: sessionData[currentSessionId] };
      sessionStorage.setItem(SESSION_TRACE_KEY, JSON.stringify(reducedSessionData));
    }
    
    // Update in-memory cache to match localStorage
    window.__agentTraceCache = nodesToKeep;
    
    // Log cleanup stats
    const originalNodeCount = Object.keys(cachedData).length;
    const keptNodeCount = Object.keys(nodesToKeep).length;
    console.log(`🗑️ Cleaned up ${originalNodeCount - keptNodeCount} nodes, keeping ${keptNodeCount} from current session`);
  } catch (error) {
    console.error('Error during session cleanup:', error);
  }
  
  // Update last cleanup time and reset flag
  lastCleanupTime = Date.now();
  cleanupInProgress = false;
}

// Counter for storage errors to implement circuit breaker pattern
let storageErrorCount = 0;
const MAX_STORAGE_ERRORS = 3;
const MAX_TRACES_PER_NODE = 5;

/**
 * Function to optimize trace data by removing redundant information
 * to reduce storage size
 * 
 * @param traceGroup The trace group to optimize
 * @returns Optimized trace group with reduced size
 */
const optimizeTraceData = (traceGroup: TraceGroup): TraceGroup => {
  // Create a deep copy to avoid modifying the original
  const optimizedTrace = JSON.parse(JSON.stringify(traceGroup)) as TraceGroup;
  
  // Remove redundant fullJson content which often contains duplicate data
  if (optimizedTrace.tasks && Array.isArray(optimizedTrace.tasks)) {
    optimizedTrace.tasks.forEach(task => {
      // Remove fullJson to reduce storage size
      if (task.fullJson) {
        task.fullJson = null;
      }
      
      // Handle subtasks
      if (task.subTasks && Array.isArray(task.subTasks)) {
        task.subTasks.forEach(subtask => {
          if (subtask.fullJson) {
            subtask.fullJson = null;
          }
        });
      }
    });
  }
  
  return optimizedTrace;
};

/**
 * Prunes trace storage to keep only recent traces and reduce storage size
 * 
 * @param existingData Current trace cache data
 * @returns Pruned trace cache data
 */
const pruneTraceStorage = (existingData: any): any => {
  try {
    const nodeIds = Object.keys(existingData);
    
    // Keep only the MAX_TRACES_PER_NODE most recent traces per node
    nodeIds.forEach(nodeId => {
      if (existingData[nodeId] && existingData[nodeId].traces) {
        const traces = existingData[nodeId].traces;
        const traceIds = Object.keys(traces);
        
        // If we have more than the max number of traces, sort by lastUpdated and keep only the most recent
        if (traceIds.length > MAX_TRACES_PER_NODE) {
          const sortedTraceIds = traceIds.sort((a, b) => {
            return traces[b].lastUpdated - traces[a].lastUpdated;
          });
          
          // Keep only the most recent traces
          const traceIdsToKeep = sortedTraceIds.slice(0, MAX_TRACES_PER_NODE);
          
          // Create new traces object with only the traces to keep
          const prunedTraces = {};
          traceIdsToKeep.forEach(id => {
            prunedTraces[id] = traces[id];
          });
          
          // Replace with pruned traces
          existingData[nodeId].traces = prunedTraces;
          console.log(`📦 Pruned traces for ${nodeId}: kept ${traceIdsToKeep.length} of ${traceIds.length} traces`);
        }
      }
    });
    
    return existingData;
  } catch (error) {
    console.warn('Error pruning trace storage:', error);
    // Return original data on error - this is a best-effort operation
    return existingData;
  }
};

/**
 * Store trace data for an agent node
 * 
 * @param nodeId The ID of the agent node
 * @param traceGroup The trace group data to store
 * @param sessionId Optional session ID to associate with this trace
 * @param preserveExistingTraces Whether to preserve other traces for this node (default: true for browser node, false otherwise)
 */
export const storeAgentTrace = (
  nodeId: string, 
  traceGroup: TraceGroup, 
  sessionId?: string,
  preserveExistingTraces?: boolean
): void => {
  try {
    // Special handling for browser node - always preserve its traces
    const shouldPreserveTraces = preserveExistingTraces !== undefined ? 
      preserveExistingTraces : (nodeId === 'customer');
      
    // Update the in-memory cache first
    if (!window.__agentTraceCache) {
      window.__agentTraceCache = {};
    }

    // Initialize the node entry if it doesn't exist
    if (!window.__agentTraceCache[nodeId]) {
      window.__agentTraceCache[nodeId] = {
        traces: {},
        lastUpdated: Date.now()
      };
    }

    // Optimize trace data before storing to reduce size
    const optimizedTraceGroup = optimizeTraceData(traceGroup);

    // Add to the in-memory cache
    window.__agentTraceCache[nodeId].traces[traceGroup.id] = {
      traceGroup: optimizedTraceGroup,
      lastUpdated: Date.now()
    };
    window.__agentTraceCache[nodeId].lastUpdated = Date.now();

    // Also update local storage for persistence across page reloads
    let existingData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
    
    // Check if this trace is marked as complete to stop continuous processing
    if (traceGroup.isComplete) {
      console.log(`🛑 Storing completed trace for agent ${nodeId} - stopping further processing`);
    }
    
    // Initialize the node entry in local storage if it doesn't exist
    if (!existingData[nodeId] || !shouldPreserveTraces) {
      existingData[nodeId] = {
        traces: {},
        lastUpdated: Date.now(),
        sessionId
      };
    }
    
    // Add the optimized trace group
    existingData[nodeId].traces[traceGroup.id] = {
      traceGroup: optimizedTraceGroup,
      lastUpdated: Date.now(),
      isComplete: optimizedTraceGroup.isComplete || false
    };
    
    // Prune storage to keep only recent traces
    existingData = pruneTraceStorage(existingData);
    
    try {
      // Attempt to save to localStorage
      localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(existingData));
      // Reset error count on success
      storageErrorCount = 0;
    } catch (storageError) {
      storageErrorCount++;
      console.error(`Error storing agent trace data (${storageErrorCount}/${MAX_STORAGE_ERRORS}):`, storageError);
      
      if (storageErrorCount >= MAX_STORAGE_ERRORS) {
        // Attempt emergency cleanup
        try {
          // Keep only the essential data - clear everything else
          const emergencyData = {};
          
          // Only keep current node data
          if (existingData[nodeId]) {
            emergencyData[nodeId] = {
              traces: {},
              lastUpdated: Date.now()
            };
            
            // Just keep this single trace
            emergencyData[nodeId].traces[traceGroup.id] = {
              traceGroup: optimizedTraceGroup,
              lastUpdated: Date.now()
            };
          }
          
          localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(emergencyData));
          console.log('🚨 Emergency storage cleanup performed - deleted all but current trace');
        } catch (emergencyError) {
          // If that fails too, try wiping clean
          localStorage.removeItem(TRACE_STORAGE_KEY);
          console.error('‼️ Storage completely cleared due to persistent errors');
        }
      }
    }

    // For the current session, also store in sessionStorage
    if (sessionId) {
      const sessionData = JSON.parse(sessionStorage.getItem(SESSION_TRACE_KEY) || '{}');
      if (!sessionData[sessionId]) {
        sessionData[sessionId] = {};
      }
      
      // Initialize node entry if it doesn't exist
      if (!sessionData[sessionId][nodeId] || !shouldPreserveTraces) {
        sessionData[sessionId][nodeId] = {
          traces: {},
          lastUpdated: Date.now()
        };
      }
      
      // Add the optimized trace
      sessionData[sessionId][nodeId].traces[traceGroup.id] = {
        traceGroup: optimizedTraceGroup,
        lastUpdated: Date.now()
      };
      
      // Session storage is typically smaller than local storage
      // We should prune this too to prevent issues
      if (sessionData[sessionId][nodeId].traces) {
        const traceIds = Object.keys(sessionData[sessionId][nodeId].traces);
        if (traceIds.length > MAX_TRACES_PER_NODE) {
          const sortedTraceIds = traceIds.sort((a, b) => {
            const aData = sessionData[sessionId][nodeId].traces[a];
            const bData = sessionData[sessionId][nodeId].traces[b];
            return bData.lastUpdated - aData.lastUpdated;
          });
          
          // Keep only the most recent traces
          const prunedTraces = {};
          sortedTraceIds.slice(0, MAX_TRACES_PER_NODE).forEach(id => {
            prunedTraces[id] = sessionData[sessionId][nodeId].traces[id];
          });
          
          sessionData[sessionId][nodeId].traces = prunedTraces;
        }
      }
      
      try {
        sessionStorage.setItem(SESSION_TRACE_KEY, JSON.stringify(sessionData));
      } catch (sessionError) {
        console.warn('Session storage error, clearing older session data:', sessionError);
        
        // If this fails, just clear all session data
        try {
          // Keep only current session
          const reducedSessionData = { [sessionId]: sessionData[sessionId] };
          sessionStorage.setItem(SESSION_TRACE_KEY, JSON.stringify(reducedSessionData));
        } catch (e) {
          // If that still fails, clear everything
          sessionStorage.removeItem(SESSION_TRACE_KEY);
        }
      }
    }

    // Use a hash to identify this exact trace data to prevent redundant events
    const traceHash = `${nodeId}-${traceGroup.id}-${traceGroup.lastUpdateTime || Date.now()}`;
    
    // Check if we've already dispatched an event for this exact trace state
    if (!window.__lastTraceEventHash || window.__lastTraceEventHash !== traceHash) {
      window.__lastTraceEventHash = traceHash;
      // Only log for significant events, not routine updates
      if (traceGroup.isComplete) {
        console.log(`✅ Stored final trace data for agent node ${nodeId}`);
      }
      
      // Dispatch an event to notify components that trace data has been updated
      // Include the source property to help identify the origin of this event
      const traceUpdateEvent = new CustomEvent('agentTraceUpdated', {
        detail: {
          nodeId,
          traceGroup,
          timestamp: Date.now(),
          source: 'storage',
          traceHash
        }
      });
      
      // Use requestAnimationFrame to prevent rapid redundant updates
      window.requestAnimationFrame(() => {
        document.dispatchEvent(traceUpdateEvent);
      });
    } else {
      // Skip redundant event dispatch without logging
      // This reduces console spam for routine trace updates
    }
  } catch (error) {
    console.error('Error storing agent trace data:', error);
  }
};

/**
 * Check if a trace belongs to the specified node based on agentId,
 * originalAgentType, or other identifiers in the trace
 * 
 * @param nodeId The node ID to check
 * @param traceGroup The trace group to validate
 * @returns True if the trace belongs to this node, false otherwise
 */
export const validateTraceOwnership = (nodeId: string, traceGroup: TraceGroup): boolean => {

  // Always allow 'customer' node to access any trace with browser-related identifiers
  if (nodeId === 'customer' && 
     (traceGroup.originalAgentType === 'Browser' || 
      traceGroup.dropdownTitle?.includes('Browser') ||
      traceGroup.dropdownTitle?.includes('User Message'))) {
    return true;
  }
  
  // For agent nodes, check if the trace explicitly belongs to this agent
  // Check direct agentId match
  if (traceGroup.agentId === nodeId) {
    return true;
  }
  
  // Check originalAgentType mapping to nodeId
  const mappedNodeId = collaboratorToNodeId(traceGroup.originalAgentType || '', true);
  if (mappedNodeId === nodeId) {
    return true;
  }
  
  // For certain special nodes, be more lenient
  if (nodeId === 'supervisor-agent' && 
     (traceGroup.originalAgentType?.toLowerCase()?.includes('supervisor') ||
      !traceGroup.originalAgentType)) { // Supervisor can also show traces with no agent type
    return true;
  }
  
  // Special handling for personalization agent - be more permissive
  if (nodeId === 'personalization-agent') {
    // Look for any task or trace content containing personalization terms
    const hasPersonalizationContent = traceGroup.tasks?.some(task => {
      // Check task title
      if (task.title?.toLowerCase().includes('personal')) return true;
      
      // Check task content
      if (typeof task.content === 'string' && 
          task.content.toLowerCase().includes('personalization')) return true;
      
      // Check subtasks
      if (task.subTasks?.some(subtask => 
        subtask.title?.toLowerCase().includes('personal') || 
        (typeof subtask.content === 'string' && 
         subtask.content.toLowerCase().includes('personalization'))
      )) {
        return true;
      }
      
      return false;
    });
    
    if (hasPersonalizationContent) {
      console.log('✅ Found personalization content in trace, validating as belonging to personalization agent');
      return true;
    }
    
    // Check if any text in the trace group includes personalization terms
    if (traceGroup.text?.toLowerCase().includes('personal')) {
      console.log('✅ Found personalization term in trace text, validating as belonging to personalization agent');
      return true;
    }
    
    // For personalization agent specifically, be extra permissive with any supervisor trace
    if (traceGroup.originalAgentType?.toLowerCase()?.includes('supervisor')) {
      console.log('✅ Allowing personalization agent to access supervisor trace data');
      return true;
    }
  }
  
  // Check for explicit node name in dropdownTitle
  const formattedNodeName = nodeId.replace('-agent', '').replace('-', ' ');
  if (traceGroup.dropdownTitle?.toLowerCase()?.includes(formattedNodeName.toLowerCase())) {
    return true;
  }
  
  // Also check for content in task titles matching node name for special agents
  if ((nodeId === 'personalization-agent' || nodeId === 'product-rec-agent' || nodeId === 'ts-agent' || nodeId === 'order-mgmt-agent') && 
      traceGroup.tasks && traceGroup.tasks.length > 0) {
    
    // Extract node name without '-agent' suffix
    const agentBaseName = nodeId.replace('-agent', '');
    
    // Check if any task title contains this node name
    const hasMatchingTask = traceGroup.tasks.some(task => {
      if (!task.title) return false;
      
      // For personalization agent, check for 'personal'
      if (agentBaseName === 'personalization' && 
          task.title.toLowerCase().includes('personal')) {
        return true;
      }
      
      // For product recommendation agent, check for 'product'
      if (agentBaseName === 'product-rec' && 
          task.title.toLowerCase().includes('product')) {
        return true;
      }
      
      // For troubleshooting agent, check for 'trouble'
      if (agentBaseName === 'ts' && 
          task.title.toLowerCase().includes('trouble')) {
        return true;
      }
      
      // For order management agent, check for 'order'
      if (agentBaseName === 'order-mgmt' && 
          task.title.toLowerCase().includes('order')) {
        return true;
      }
      
      return false;
    });
    
    if (hasMatchingTask) {
      console.log(`✅ Found task title matching ${nodeId} pattern, validating as belonging to this agent`);
      return true;
    }
  }
  
  // If none of the checks pass, the trace doesn't belong to this node
  if (nodeId === 'personalization-agent') {
    console.log('❌ Trace validation failed for personalization agent');
  }
  return false;
};

/**
 * Get trace data for an agent node
 * 
 * @param nodeId The ID of the agent node
 * @param traceId Optional specific trace ID to retrieve (if not provided, returns most recent)
 * @param strictOwnership Whether to strictly enforce trace ownership validation (default: true)
 * @returns The stored trace group data, or null if not found
 */
export const getAgentTrace = (nodeId: string, traceId?: string, strictOwnership: boolean = true): TraceGroup | null => {
  try {
    // First check the in-memory cache for the most up-to-date data
    if (window.__agentTraceCache && window.__agentTraceCache[nodeId]) {
      const nodeData = window.__agentTraceCache[nodeId];
      
      // If a specific traceId is requested, return that trace
      if (traceId && nodeData.traces[traceId]) {
        const traceGroup = nodeData.traces[traceId].traceGroup;
        
        // Validate that this trace belongs to this node
        if (strictOwnership && !validateTraceOwnership(nodeId, traceGroup)) {
          console.warn(`Requested trace ${traceId} doesn't belong to node ${nodeId}`);
          return null;
        }
        
        return traceGroup;
      }
      
      // Otherwise, find the most recent trace
      const traceEntries = Object.entries(nodeData.traces);
      if (traceEntries.length === 0) return null;
      
      // Sort by lastUpdated timestamp (most recent first)
      traceEntries.sort((a, b) => {
        const aData = a[1] as {lastUpdated: number};
        const bData = b[1] as {lastUpdated: number};
        return bData.lastUpdated - aData.lastUpdated;
      });
      
      // For browser node, try to find a user message trace first
      if (nodeId === 'customer') {
        // Look for a trace with "User Message" in the dropdownTitle
        const userMessageTrace = traceEntries.find(([_, data]) => {
          const traceData = data as {traceGroup: TraceGroup};
          return traceData.traceGroup.dropdownTitle?.includes('User Message');
        });
        
        // If found, return that
        if (userMessageTrace) {
          const traceData = userMessageTrace[1] as {traceGroup: TraceGroup};
          
          // No need to validate browser traces - they're special
          return traceData.traceGroup;
        }
      }
      
      // Filter traces by ownership if strict mode is enabled
      let validTraceEntries = traceEntries;
      if (strictOwnership) {
        validTraceEntries = traceEntries.filter(([_, data]) => {
          const traceData = data as {traceGroup: TraceGroup};
          return validateTraceOwnership(nodeId, traceData.traceGroup);
        });
        
        // If we filtered out all traces, fall back to using any traces only if we're in a special case
        if (validTraceEntries.length === 0) {
          if (nodeId === 'customer' || nodeId === 'supervisor-agent') {
            // For these special nodes, we can be less strict
            validTraceEntries = traceEntries;
          } else {
            // For other nodes, respect the strict ownership
            return null;
          }
        }
      }
      
      // If we have valid traces, return the most recent one
      if (validTraceEntries.length > 0) {
        const mostRecentData = validTraceEntries[0][1] as {traceGroup: TraceGroup};
        return mostRecentData.traceGroup;
      }
      
      return null;
    }

    // Then check local storage
    const cachedData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
    if (cachedData[nodeId]) {
      // If found in local storage but not in memory, update the memory cache
      if (!window.__agentTraceCache) {
        window.__agentTraceCache = {};
      }
      
      window.__agentTraceCache[nodeId] = cachedData[nodeId];
      
      // Similar logic as above for local storage data
      if (traceId && cachedData[nodeId].traces && cachedData[nodeId].traces[traceId]) {
        const traceGroup = cachedData[nodeId].traces[traceId].traceGroup;
        
        // Validate that this trace belongs to this node
        if (strictOwnership && !validateTraceOwnership(nodeId, traceGroup)) {
          console.warn(`Requested trace ${traceId} from storage doesn't belong to node ${nodeId}`);
          return null;
        }
        
        return traceGroup;
      }
      
      // Find most recent trace
      if (cachedData[nodeId].traces) {
        const traceEntries = Object.entries(cachedData[nodeId].traces);
        if (traceEntries.length === 0) return null;
        
        // Sort by lastUpdated timestamp (most recent first)
        traceEntries.sort((a, b) => {
          const aData = a[1] as {lastUpdated: number};
          const bData = b[1] as {lastUpdated: number};
          return bData.lastUpdated - aData.lastUpdated;
        });
        
        // For browser node, try to find a user message trace first
        if (nodeId === 'customer') {
          // Look for a trace with "User Message" in the dropdownTitle
          const userMessageTrace = traceEntries.find(([_, data]) => {
            const traceData = data as {traceGroup: TraceGroup};
            return traceData.traceGroup.dropdownTitle?.includes('User Message');
          });
          
          // If found, return that
          if (userMessageTrace) {
            const traceData = userMessageTrace[1] as {traceGroup: TraceGroup};
            return traceData.traceGroup;
          }
        }
        
        // Filter traces by ownership if strict mode is enabled
        let validTraceEntries = traceEntries;
        if (strictOwnership) {
          validTraceEntries = traceEntries.filter(([_, data]) => {
            const traceData = data as {traceGroup: TraceGroup};
            return validateTraceOwnership(nodeId, traceData.traceGroup);
          });
          
          // If we filtered out all traces, fall back to any traces only for special cases
          if (validTraceEntries.length === 0) {
            if (nodeId === 'customer' || nodeId === 'supervisor-agent') {
              // For these special nodes, we can be less strict
              validTraceEntries = traceEntries;
            } else {
              // For other nodes, respect the strict ownership
              return null;
            }
          }
        }
        
        // If we have valid traces, return the most recent one
        if (validTraceEntries.length > 0) {
          const mostRecentData = validTraceEntries[0][1] as {traceGroup: TraceGroup};
          return mostRecentData.traceGroup;
        }
        
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving agent trace data:', error);
    return null;
  }
};

/**
 * Get all traces for an agent node
 * 
 * @param nodeId The ID of the agent node
 * @returns Array of trace groups, or empty array if not found
 */
export const getAllNodeTraces = (nodeId: string): TraceGroup[] => {
  try {
    const traces: TraceGroup[] = [];
    
    // First check in-memory cache
    if (window.__agentTraceCache && window.__agentTraceCache[nodeId]) {
      const nodeData = window.__agentTraceCache[nodeId];
      
      // Collect all traces for this node
      Object.values(nodeData.traces).forEach(traceData => {
        traces.push(traceData.traceGroup);
      });
    }
    
    // If no traces found in memory cache, check local storage
    if (traces.length === 0) {
      const cachedData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
      if (cachedData[nodeId] && cachedData[nodeId].traces) {
        Object.values(cachedData[nodeId].traces).forEach((traceData) => {
          if (traceData && typeof traceData === 'object' && 'traceGroup' in traceData) {
            traces.push(traceData.traceGroup as TraceGroup);
          }
        });
      }
    }
    
    // Sort by timestamp (oldest first) to maintain chronological order
    return traces.sort((a, b) => {
      const aTime = a.startTime || 0;
      const bTime = b.startTime || 0;
      return aTime - bTime;
    });
  } catch (error) {
    console.error('Error retrieving all node traces:', error);
    return [];
  }
};

/**
 * Get all stored agent traces
 * 
 * @returns An object mapping node IDs to arrays of their trace groups
 */
export const getAllAgentTraces = (): { [nodeId: string]: TraceGroup[] } => {
  try {
    const traces: { [nodeId: string]: TraceGroup[] } = {};
    
    // First check in-memory cache
    if (window.__agentTraceCache) {
      Object.keys(window.__agentTraceCache).forEach(nodeId => {
        const nodeData = window.__agentTraceCache[nodeId];
        if (nodeData && nodeData.traces) {
          traces[nodeId] = [];
          
          // Collect all traces for this node
          Object.values(nodeData.traces).forEach(traceData => {
            if (traceData && traceData.traceGroup) {
              traces[nodeId].push(traceData.traceGroup);
            }
          });
          
          // Sort by timestamp
          traces[nodeId].sort((a, b) => {
            const aTime = a.startTime || 0;
            const bTime = b.startTime || 0;
            return aTime - bTime;
          });
        }
      });
    }
    
    // Then add any additional data from local storage
    const cachedData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
    Object.keys(cachedData).forEach(nodeId => {
      if (!traces[nodeId] && cachedData[nodeId].traces) {
        traces[nodeId] = [];
        
        // Collect all traces for this node
        Object.values(cachedData[nodeId].traces).forEach((traceData) => {
          if (traceData && typeof traceData === 'object' && 'traceGroup' in traceData) {
            traces[nodeId].push(traceData.traceGroup as TraceGroup);
          }
        });
        
        // Sort by timestamp
        traces[nodeId].sort((a, b) => {
          const aTime = a.startTime || 0;
          const bTime = b.startTime || 0;
          return aTime - bTime;
        });
      }
    });
    
    return traces;
  } catch (error) {
    console.error('Error retrieving all agent traces:', error);
    return {};
  }
};

/**
 * Clear trace data for an agent node
 * 
 * @param nodeId The ID of the agent node
 */
export const clearAgentTrace = (nodeId: string): void => {
  try {
    // Clear from in-memory cache
    if (window.__agentTraceCache && window.__agentTraceCache[nodeId]) {
      delete window.__agentTraceCache[nodeId];
    }
    
    // Clear from local storage
    const cachedData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
    if (cachedData[nodeId]) {
      delete cachedData[nodeId];
      localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(cachedData));
    }
    
    // Dispatch an event to notify components
    const traceClearedEvent = new CustomEvent('agentTraceCleared', {
      detail: {
        nodeId,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(traceClearedEvent);
  } catch (error) {
    console.error('Error clearing agent trace data:', error);
  }
};

/**
 * Clear all stored agent traces
 * 
 * @param sessionId Optional session ID to only clear traces for a specific session
 */
export const clearAllAgentTraces = (sessionId?: string): void => {
  try {
    if (sessionId) {
      // Clear just for this session
      const sessionData = JSON.parse(sessionStorage.getItem(SESSION_TRACE_KEY) || '{}');
      if (sessionData[sessionId]) {
        delete sessionData[sessionId];
        sessionStorage.setItem(SESSION_TRACE_KEY, JSON.stringify(sessionData));
      }
      
      // Update the main storage to remove this session's traces
      const cachedData = JSON.parse(localStorage.getItem(TRACE_STORAGE_KEY) || '{}');
      Object.keys(cachedData).forEach(nodeId => {
        if (cachedData[nodeId].sessionId === sessionId) {
          delete cachedData[nodeId];
        }
      });
      localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(cachedData));
      
      // Update in-memory cache
      if (window.__agentTraceCache) {
        Object.keys(window.__agentTraceCache).forEach(nodeId => {
          // We don't store sessionId in memory cache, so we'll have to rely on the clear event
          // to trigger components to update
        });
      }
    } else {
      // Clear everything
      localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify({}));
      sessionStorage.removeItem(SESSION_TRACE_KEY);
      window.__agentTraceCache = {};
    }
    
    // Dispatch an event to notify components
    const allClearedEvent = new CustomEvent('allAgentTracesCleared', {
      detail: {
        sessionId,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(allClearedEvent);
  } catch (error) {
    console.error('Error clearing all agent trace data:', error);
  }
};

/**
 * Helper function to ensure consistent trace data structure
 * This is used by both the chat window and agent flow diagram to
 * ensure trace dropdowns appear identical in both contexts.
 * 
 * @param traceGroup The trace group to normalize
 * @returns Normalized trace group with consistent structure
 */
export const normalizeTraceGroup = (traceGroup: TraceGroup): TraceGroup => {
  if (!traceGroup) return traceGroup;
  
  // Create a deep copy to avoid modifying the original
  const normalizedTraceGroup = JSON.parse(JSON.stringify(traceGroup)) as TraceGroup;
  
  // Process tasks - organize subtasks consistently
  if (normalizedTraceGroup.tasks && Array.isArray(normalizedTraceGroup.tasks)) {
    normalizedTraceGroup.tasks = normalizedTraceGroup.tasks.map(task => {
      // Group related subtasks under their parent tasks
      if (task.subTasks && task.subTasks.length > 0) {
        // Organize knowledge base subtasks
        if (task.title.includes('Knowledge Base')) {
          const kbInputTasks = task.subTasks.filter(st => 
            st.title.toLowerCase().includes('knowledge base query') || 
            st.title.toLowerCase().includes('knowledge base input'));
            
          const kbOutputTasks = task.subTasks.filter(st => 
            st.title.toLowerCase().includes('knowledge base results') || 
            st.title.toLowerCase().includes('knowledge base output'));
            
          // Ensure input tasks come before output tasks
          task.subTasks = [...kbInputTasks, ...kbOutputTasks];
        }
        
        // Organize action group subtasks
        else if (task.title.includes('Action Group')) {
          const agInputTasks = task.subTasks.filter(st => 
            st.title.toLowerCase().includes('action group input'));
            
          const agOutputTasks = task.subTasks.filter(st => 
            st.title.toLowerCase().includes('action group output') || 
            st.title.toLowerCase().includes('action group result'));
            
          // Ensure input tasks come before output tasks
          task.subTasks = [...agInputTasks, ...agOutputTasks];
        }
        
        // Organize model invocation subtasks
        else if (task.title.includes('Invoking Model')) {
          const modelInputTasks = task.subTasks.filter(st => 
            st.title.toLowerCase().includes('model input'));
            
          const modelOutputTasks = task.subTasks.filter(st => 
            st.title.toLowerCase().includes('model output'));
            
          // Ensure input tasks come before output tasks
          task.subTasks = [...modelInputTasks, ...modelOutputTasks];
        }
        
        // Sort subtasks by timestamp for other task types
        else {
          task.subTasks.sort((a, b) => a.timestamp - b.timestamp);
        }
      }
      
      return task;
    });
    
    // Identify Final Response tasks that should go at the very end
    const finalResponseTasks = normalizedTraceGroup.tasks.filter(task =>
      task.title?.includes('Final Response'));

    // Get all other tasks (including Rationale and Observation)
    const otherTasks = normalizedTraceGroup.tasks.filter(task =>
      !task.title?.includes('Final Response'));
    
    // Find any Rationale task
    const rationaleTasks = otherTasks.filter(task =>
      task.title?.includes('Rationale'));
    
    // Find any Observation tasks
    const observationTasks = otherTasks.filter(task =>
      task.title?.includes('Observation'));
    
    // Get regular processing tasks (excluding Rationale and Observation)
    const processingTasks = otherTasks.filter(task =>
      !task.title?.includes('Rationale') && !task.title?.includes('Observation'));
    
    // Sort processing tasks by step number and timestamp
    processingTasks.sort((a, b) => {
      // First sort by step number
      if (a.stepNumber !== b.stepNumber) {
        return a.stepNumber - b.stepNumber;
      }
      
      // If step numbers are the same, sort by timestamp
      return a.timestamp - b.timestamp;
    });

    // Position the Rationale task after Step 1
    // Find if we have a Step 1 task
    const step1Index = processingTasks.findIndex(task => 
      task.title?.includes('Step 1:') || 
      task.stepNumber === 1);

    // Create initial ordered tasks with Rationale after Step 1 if applicable
    let orderedTasks = [];
    
    if (step1Index >= 0 && rationaleTasks.length > 0) {
      // Add Step 1
      orderedTasks = [
        ...processingTasks.slice(0, step1Index + 1),
        ...rationaleTasks, // Add Rationale after Step 1
        ...processingTasks.slice(step1Index + 1) // Add remaining steps
      ];
    } else {
      // If no Step 1 or no Rationale, just keep processing tasks in order
      orderedTasks = [...processingTasks, ...rationaleTasks];
    }
    
    // Now insert Observation tasks in proper chronological order
    if (observationTasks.length > 0) {
      // First, we need to determine where to place each Observation task
      // Sort Observation tasks by timestamp to maintain their relative order
      const sortedObservationTasks = [...observationTasks].sort((a, b) => a.timestamp - b.timestamp);
      
      const finalOrderedTasks: Task[] = [];
      
      // If we have agent invocation steps, place observations after their corresponding agent
      // This typically creates a pattern like:
      // Step X: Agent Invocation - AgentName
      // Observation (from that agent)
      let lastAgentInvocationIndex = -1;
      
      for (let i = 0; i < orderedTasks.length; i++) {
        const currentTask = orderedTasks[i];
        finalOrderedTasks.push(currentTask);
        
        // Check if this is an agent invocation step
        if (currentTask.title?.includes('Agent Invocation')) {
          lastAgentInvocationIndex = finalOrderedTasks.length - 1;
          
          // If we have observation tasks that were recorded after this agent invocation
          // but before the next step, insert them right after this agent invocation
          const agentTimestamp = currentTask.timestamp;
          const nextTaskTimestamp = orderedTasks[i + 1]?.timestamp ?? Infinity;
          
          // Find observations that occurred after this agent and before the next step
          const matchingObservations = sortedObservationTasks.filter(task => 
            task.timestamp > agentTimestamp && task.timestamp < nextTaskTimestamp
          );
          
          // Add these observations after the current task
          if (matchingObservations.length > 0) {
            finalOrderedTasks.push(...matchingObservations);
            
            // Remove these observations from our sorted list
            for (const observation of matchingObservations) {
              const index = sortedObservationTasks.indexOf(observation);
              if (index >= 0) {
                sortedObservationTasks.splice(index, 1);
              }
            }
          }
        }
      }
      
      // Add any remaining observations at their closest chronological position
      if (sortedObservationTasks.length > 0) {
        // For any remaining observations, insert them at the appropriate timestamp position
        // This ensures they appear in the correct sequence even if they don't follow an agent invocation
        for (const observation of sortedObservationTasks) {
          let inserted = false;
          
          for (let i = 0; i < finalOrderedTasks.length - 1; i++) {
            if (
              observation.timestamp >= finalOrderedTasks[i].timestamp &&
              observation.timestamp < finalOrderedTasks[i + 1].timestamp
            ) {
              finalOrderedTasks.splice(i + 1, 0, observation);
              inserted = true;
              break;
            }
          }
          
          if (!inserted) {
            // If we couldn't find a specific place, add to the end of the main tasks
            // (before finalResponseTasks)
            finalOrderedTasks.push(observation);
          }
        }
      }
      
      orderedTasks = finalOrderedTasks;
    }
    
    // Put the tasks back together with Final Response at the end
    normalizedTraceGroup.tasks = [...orderedTasks, ...finalResponseTasks];
  }
  
  return normalizedTraceGroup;
};

/**
 * Update the display configuration and structure of the TraceGroup
 * before rendering to ensure consistent appearance across
 * all instances of trace data displays.
 * 
 * @param traceGroup The trace group to prepare for display
 * @returns Display-ready trace group
 */
export const prepareTraceGroupForDisplay = (traceGroup: TraceGroup): TraceGroup => {
  // First normalize the trace group structure
  const normalizedTraceGroup = normalizeTraceGroup(traceGroup);
  
  // Apply additional display formatting if needed
  // For example, we could update titles, arrange tasks in a specific order, etc.
  
  return normalizedTraceGroup;
};

// Track unmapped collaborators to avoid flood of console warnings
const unmappedCollaborators = new Set<string>();

/**
 * Map a collaborator name to a node ID
 * 
 * @param collaboratorName The name of the collaborator from trace data
 * @param strictMapping If true, returns null instead of fallback when no mapping is found
 * @returns The corresponding node ID or null if no mapping found and strictMapping is true
 */
export const collaboratorToNodeId = (collaboratorName: string, strictMapping: boolean = false): string | null => {
  // Handle null or undefined case
  if (!collaboratorName) {
    return strictMapping ? null : 'supervisor-agent';
  }

  // EXACT MATCHES - highest priority for specific values we need to ensure are detected
  // Routing classifier has been merged into supervisor, so direct these to supervisor-agent
  if (collaboratorName === 'ROUTING_CLASSIFIER' || 
      collaboratorName === 'routing_classifier' ||
      collaboratorName === 'RoutingClassifier') {
    return 'supervisor-agent';
  }
  
  if (collaboratorName === 'Supervisor' ||
      collaboratorName === 'SupervisorAgent' ||
      collaboratorName === 'SUPERVISOR') {
    return 'supervisor-agent';
  }
  
  if (collaboratorName === 'Unknown') {
    // Map "Unknown" to supervisor agent (or null if strictMapping)
    return strictMapping ? null : 'supervisor-agent';
  }
  
  // Pattern-based matching for other cases
  // Standardize collaborator name
  const normalizedName = collaboratorName.toLowerCase();

  // Map collaborator names to node IDs - be more explicit with naming patterns
  if (normalizedName.includes('order') || normalizedName === 'ordermanagement') {
    return 'order-mgmt-agent';
  } else if (normalizedName.includes('product') || normalizedName === 'productrecommendation') {
    return 'product-rec-agent';
  } else if (normalizedName.includes('personal') || normalizedName === 'personalization') {
    return 'personalization-agent';
  } else if (normalizedName.includes('trouble') || normalizedName === 'troubleshoot') {
    return 'ts-agent';
  } else if (normalizedName.includes('rout') || normalizedName.includes('class')) {
    return 'supervisor-agent'; // Routing classifier is now merged into supervisor
  } else if (normalizedName.includes('super')) {
    return 'supervisor-agent';
  }

  // For any other collaborator, either return null (strict mode) or supervisor-agent (fallback mode)
  if (strictMapping) {
    // Only log unmapped collaborators once to avoid console spam
    if (!unmappedCollaborators.has(collaboratorName)) {
      unmappedCollaborators.add(collaboratorName);
      console.warn(`No strict mapping found for collaborator: ${collaboratorName}`);
    }
    return null;
  }

  return 'supervisor-agent';
};

// Initialize the storage when this module is imported
initAgentTraceStorage();

/**
 * Trace Debug Helper
 * 
 * Utility for debugging agent trace data in the browser console.
 * This helper provides functions to extract, analyze, and display trace data
 * in a more readable format for debugging purposes.
 */

// Store a reference to the original console.log for proper formatting
const originalConsoleLog = console.log;

/**
 * Format and colorize trace data output in console
 * 
 * @param {string} type - Type of trace data (e.g., "trace", "step", "task")
 * @param {Object} data - The trace data to format
 * @param {Object} options - Additional options for formatting
 * @returns {void}
 */
export function logTrace(type, data, options = {}) {
  const colors = {
    trace: 'background: #4a148c; color: white; padding: 2px 5px; border-radius: 3px;',
    step: 'background: #1565c0; color: white; padding: 2px 5px; border-radius: 3px;',
    task: 'background: #2e7d32; color: white; padding: 2px 5px; border-radius: 3px;',
    subtask: 'background: #ef6c00; color: white; padding: 2px 5px; border-radius: 3px;',
    warning: 'background: #f57f17; color: white; padding: 2px 5px; border-radius: 3px;',
    error: 'background: #b71c1c; color: white; padding: 2px 5px; border-radius: 3px;',
    success: 'background: #1b5e20; color: white; padding: 2px 5px; border-radius: 3px;',
  };
  
  const color = colors[type] || colors.trace;
  const label = options.label || type.toUpperCase();
  
  console.group(`%c ${label}`, color);
  
  // If data is a trace group, format it specially
  if (data && data.type === 'trace-group') {
    console.log('Trace Group ID:', data.id);
    console.log('Agent Type:', data.originalAgentType || data.agentId);
    console.log('Task Count:', data.tasks?.length || 0);
    
    // Log task titles if available
    if (data.tasks && data.tasks.length > 0) {
      console.groupCollapsed('Tasks');
      data.tasks.forEach((task, index) => {
        console.log(`${index + 1}. ${task.title || 'Untitled Task'}`);
      });
      console.groupEnd();
    }
    
    // Log raw data if requested
    if (options.showRaw) {
      console.groupCollapsed('Raw Data');
      console.log(data);
      console.groupEnd();
    }
  } else {
    // For regular data, just log it
    console.log(data);
  }
  
  console.groupEnd();
}

/**
 * Extract specific tasks from a trace group based on criteria
 * 
 * @param {Object} traceGroup - The trace group to extract tasks from
 * @param {Function} filterFn - Filter function that returns true for tasks to include
 * @returns {Array} - Array of tasks that match the criteria
 */
export function extractTasks(traceGroup, filterFn) {
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    console.warn('Invalid trace group provided to extractTasks');
    return [];
  }
  
  return traceGroup.tasks.filter(filterFn || (() => true));
}

/**
 * Find all tasks related to a specific step
 * 
 * @param {Object} traceGroup - The trace group to search in
 * @param {number} stepNumber - The step number to find tasks for
 * @returns {Array} - Array of tasks for the given step
 */
export function findTasksByStep(traceGroup, stepNumber) {
  return extractTasks(traceGroup, task => task.stepNumber === stepNumber);
}

/**
 * Find tasks by title pattern
 * 
 * @param {Object} traceGroup - The trace group to search in
 * @param {string|RegExp} pattern - String or RegExp pattern to match task titles
 * @returns {Array} - Array of tasks that match the pattern
 */
export function findTasksByTitle(traceGroup, pattern) {
  return extractTasks(traceGroup, task => {
    if (!task.title) return false;
    
    if (pattern instanceof RegExp) {
      return pattern.test(task.title);
    }
    
    return task.title.includes(pattern);
  });
}

/**
 * Find all steps involving a specific agent
 * 
 * @param {Object} traceGroup - The trace group to search in
 * @param {string} agentId - Agent ID to search for
 * @returns {Array} - Array of tasks involving the specified agent
 */
export function findTasksByAgent(traceGroup, agentId) {
  return extractTasks(traceGroup, task => task._agentId === agentId);
}

/**
 * Calculate trace execution time information
 * 
 * @param {Object} traceGroup - The trace group to analyze
 * @returns {Object} - Timing information
 */
export function analyzeTraceTiming(traceGroup) {
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    console.warn('Invalid trace group provided to analyzeTraceTiming');
    return { totalTime: 0, stepTimes: [] };
  }
  
  // Calculate total execution time
  const totalTime = traceGroup.isComplete && traceGroup.finalElapsedTime 
    ? parseFloat(traceGroup.finalElapsedTime)
    : (traceGroup.lastUpdateTime - traceGroup.startTime) / 1000;
  
  // Calculate time per step
  const stepTimes = [];
  let lastTimestamp = traceGroup.startTime;
  
  traceGroup.tasks.forEach(task => {
    if (task.timestamp) {
      const elapsedTime = (task.timestamp - lastTimestamp) / 1000;
      stepTimes.push({
        step: task.stepNumber || 'Special',
        title: task.title || 'Untitled Task',
        timeElapsed: elapsedTime.toFixed(2) + 's',
        timestamp: task.timestamp
      });
      
      lastTimestamp = task.timestamp;
    }
  });
  
  return {
    totalTime: totalTime.toFixed(2) + 's',
    stepTimes,
    startTime: new Date(traceGroup.startTime).toISOString(),
    endTime: new Date(traceGroup.lastUpdateTime).toISOString()
  };
}

/**
 * Find long-running tasks
 * 
 * @param {Object} traceGroup - The trace group to analyze
 * @param {number} threshold - Time threshold in seconds
 * @returns {Array} - Array of tasks that took longer than the threshold
 */
export function findLongRunningTasks(traceGroup, threshold = 1.0) {
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    return [];
  }
  
  const longTasks = [];
  
  // Group tasks by step number
  const tasksByStep = traceGroup.tasks.reduce((acc, task) => {
    const stepNumber = task.stepNumber || 0;
    if (!acc[stepNumber]) {
      acc[stepNumber] = [];
    }
    acc[stepNumber].push(task);
    return acc;
  }, {});
  
  // For each step, find the time difference between first and last task
  Object.keys(tasksByStep).forEach(stepNumber => {
    const stepTasks = tasksByStep[stepNumber];
    
    // Sort tasks by timestamp
    stepTasks.sort((a, b) => a.timestamp - b.timestamp);
    
    if (stepTasks.length >= 2) {
      const firstTask = stepTasks[0];
      const lastTask = stepTasks[stepTasks.length - 1];
      
      const duration = (lastTask.timestamp - firstTask.timestamp) / 1000;
      
      if (duration > threshold) {
        longTasks.push({
          step: stepNumber,
          title: firstTask.title,
          duration: duration.toFixed(2) + 's',
          tasks: stepTasks
        });
      }
    }
    
    // Also check subtasks for long-running operations
    stepTasks.forEach(task => {
      if (task.subTasks && Array.isArray(task.subTasks) && task.subTasks.length >= 2) {
        const firstSubtask = task.subTasks[0];
        const lastSubtask = task.subTasks[task.subTasks.length - 1];
        
        if (firstSubtask.timestamp && lastSubtask.timestamp) {
          const duration = (lastSubtask.timestamp - firstSubtask.timestamp) / 1000;
          
          if (duration > threshold) {
            longTasks.push({
              step: stepNumber,
              title: task.title + ' (subtasks)',
              duration: duration.toFixed(2) + 's',
              subtasks: task.subTasks
            });
          }
        }
      }
    });
  });
  
  return longTasks;
}

/**
 * Extract model invocation information from trace data
 * 
 * @param {Object} traceGroup - The trace group to analyze
 * @returns {Array} - Array of model invocation data
 */
export function extractModelInvocations(traceGroup) {
  const modelInvocations = [];
  
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    return modelInvocations;
  }
  
  traceGroup.tasks.forEach(task => {
    // Look for model invocation tasks (usually titled "Invoking Model")
    if (task.title && task.title.includes('Invoking Model')) {
      const invocation = {
        step: task.stepNumber,
        title: task.title,
        timestamp: task.timestamp,
        input: null,
        output: null,
        stats: {}
      };
      
      // Extract input and output from subtasks
      if (task.subTasks && Array.isArray(task.subTasks)) {
        task.subTasks.forEach(subtask => {
          if (subtask.title && subtask.title.includes('Model Input')) {
            invocation.input = subtask.content;
            invocation.stats.inputTime = subtask.timestamp;
          } else if (subtask.title && subtask.title.includes('Model Output')) {
            invocation.output = subtask.content;
            invocation.stats.outputTime = subtask.timestamp;
            
            // Calculate processing time if we have both timestamps
            if (invocation.stats.inputTime && subtask.timestamp) {
              invocation.stats.processingTime = 
                ((subtask.timestamp - invocation.stats.inputTime) / 1000).toFixed(2) + 's';
            }
            
            // Extract token usage if available in content
            try {
              const content = typeof subtask.content === 'string' 
                ? JSON.parse(subtask.content) 
                : subtask.content;
                
              if (content?.output?.usage) {
                invocation.stats.tokenUsage = content.output.usage;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        });
      }
      
      modelInvocations.push(invocation);
    }
  });
  
  return modelInvocations;
}

/**
 * Extract knowledge base lookups from trace data
 * 
 * @param {Object} traceGroup - The trace group to analyze
 * @returns {Array} - Array of knowledge base lookup data
 */
export function extractKnowledgeBaseLookups(traceGroup) {
  const kbLookups = [];
  
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    return kbLookups;
  }
  
  traceGroup.tasks.forEach(task => {
    // Look for knowledge base tasks
    if (task.title && task.title.includes('Knowledge Base')) {
      const lookup = {
        step: task.stepNumber,
        title: task.title,
        timestamp: task.timestamp,
        query: null,
        results: null
      };
      
      // Extract query and results from subtasks
      if (task.subTasks && Array.isArray(task.subTasks)) {
        task.subTasks.forEach(subtask => {
          if (subtask.title && (
              subtask.title.includes('Knowledge Base Query') || 
              subtask.title.includes('Knowledge Base Input')
            )) {
            lookup.query = subtask.content;
          } else if (subtask.title && (
              subtask.title.includes('Knowledge Base Results') ||
              subtask.title.includes('Knowledge Base Output')
            )) {
            lookup.results = subtask.content;
          }
        });
      }
      
      kbLookups.push(lookup);
    }
  });
  
  return kbLookups;
}

/**
 * Extract user query and system response from a trace group
 * 
 * @param {Object} traceGroup - The trace group to analyze
 * @returns {Object|null} - Object with user query and system response
 */
export function extractConversation(traceGroup) {
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    return null;
  }
  
  let userQuery = null;
  let systemResponse = null;
  
  // Try to find user query in step 1 or model input
  const step1Tasks = findTasksByStep(traceGroup, 1);
  if (step1Tasks.length > 0) {
    // Look for model input subtasks
    const task = step1Tasks[0];
    if (task.subTasks && Array.isArray(task.subTasks)) {
      const inputSubtask = task.subTasks.find(st => 
        st.title && st.title.includes('Model Input')
      );
      
      if (inputSubtask && inputSubtask.content) {
        // Try to extract user message from model input
        try {
          const content = typeof inputSubtask.content === 'string'
            ? JSON.parse(inputSubtask.content)
            : inputSubtask.content;
            
          // Look for user message in common patterns
          if (content?.messages) {
            // Find the first user message
            const userMessage = content.messages.find(m => m.role === 'user');
            if (userMessage) {
              userQuery = userMessage.content;
            }
          } else if (content?.text) {
            userQuery = content.text;
          } else {
            userQuery = inputSubtask.content;
          }
        } catch (e) {
          userQuery = inputSubtask.content;
        }
      }
    }
  }
  
  // Try to find system response in final response or observation tasks
  const finalResponseTasks = traceGroup.tasks.filter(task => 
    task.title && task.title.includes('Final Response')
  );
  
  if (finalResponseTasks.length > 0) {
    systemResponse = finalResponseTasks[0].content;
  } else {
    // Look in all tasks for observation
    const observationTask = traceGroup.tasks.find(task =>
      task.title && task.title.includes('Observation')
    );
    
    if (observationTask) {
      systemResponse = observationTask.content;
    }
  }
  
  return {
    userQuery,
    systemResponse,
    hasUserQuery: !!userQuery,
    hasSystemResponse: !!systemResponse
  };
}

/**
 * Analyze the routing process in a trace group
 * 
 * @param {Object} traceGroup - The trace group to analyze
 * @returns {Object} - Routing information
 */
export function analyzeRouting(traceGroup) {
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    return { hasRouting: false };
  }
  
  // Look for routing classifier tasks
  const routingTasks = traceGroup.tasks.filter(task => 
    (task.title && task.title.includes('Routing Classifier')) ||
    (task._isRoutingClassifierParent === true)
  );
  
  if (routingTasks.length === 0) {
    return { hasRouting: false };
  }
  
  const routingInfo = {
    hasRouting: true,
    classifierDecision: null,
    routedTo: [],
    routingTime: null
  };
  
  // Extract routing classifier decision
  routingTasks.forEach(task => {
    // Check subtasks for classifier decision
    if (task.subTasks && Array.isArray(task.subTasks)) {
      const decisionTask = task.subTasks.find(st =>
        st.title && st.title.includes('Routing Classifier Decision')
      );
      
      if (decisionTask) {
        routingInfo.classifierDecision = decisionTask.content;
        
        // Calculate routing time
        if (task.timestamp && decisionTask.timestamp) {
          routingInfo.routingTime = 
            ((decisionTask.timestamp - task.timestamp) / 1000).toFixed(2) + 's';
        }
      }
    }
  });
  
  // Look for agent invocation tasks to determine routing destinations
  const invocationTasks = traceGroup.tasks.filter(task =>
    task.title && task.title.includes('Agent Invocation')
  );
  
  invocationTasks.forEach(task => {
    // Extract agent name from invocation task title
    const match = task.title.match(/Agent Invocation - (.+?)( |$|\()/);
    if (match && match[1]) {
      routingInfo.routedTo.push(match[1]);
    }
  });
  
  return routingInfo;
}

/**
 * Analyze the agent trace for abnormalities or issues
 * 
 * @param {Object} traceGroup - The trace group to analyze
 * @returns {Array} - Array of identified issues
 */
export function analyzeTraceIssues(traceGroup) {
  const issues = [];
  
  if (!traceGroup) {
    issues.push({
      severity: 'error',
      message: 'Invalid trace group: null or undefined'
    });
    return issues;
  }
  
  // Check for missing essential trace data
  if (!traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    issues.push({
      severity: 'error',
      message: 'Trace group has no tasks array'
    });
    return issues;
  }
  
  // Check for missing timestamps
  if (!traceGroup.startTime) {
    issues.push({
      severity: 'warning',
      message: 'Trace group missing startTime'
    });
  }
  
  if (!traceGroup.lastUpdateTime) {
    issues.push({
      severity: 'warning',
      message: 'Trace group missing lastUpdateTime'
    });
  }
  
  // Check for empty tasks array
  if (traceGroup.tasks.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'Trace group has empty tasks array'
    });
    return issues;
  }
  
  // Check for tasks with missing required properties
  traceGroup.tasks.forEach((task, index) => {
    if (!task.title) {
      issues.push({
        severity: 'warning',
        message: `Task at index ${index} missing title`
      });
    }
    
    if (!task.timestamp) {
      issues.push({
        severity: 'warning',
        message: `Task at index ${index} missing timestamp`
      });
    }
    
    // Check for model invocation issues
    if (task.title && task.title.includes('Invoking Model')) {
      const hasInput = task.subTasks && task.subTasks.some(st => 
        st.title && st.title.includes('Model Input')
      );
      
      const hasOutput = task.subTasks && task.subTasks.some(st => 
        st.title && st.title.includes('Model Output')
      );
      
      if (!hasInput && !hasOutput) {
        issues.push({
          severity: 'error',
          message: `Model invocation task at step ${task.stepNumber} has neither input nor output`
        });
      } else if (!hasInput) {
        issues.push({
          severity: 'warning',
          message: `Model invocation task at step ${task.stepNumber} missing model input`
        });
      } else if (!hasOutput) {
        issues.push({
          severity: 'warning',
          message: `Model invocation task at step ${task.stepNumber} missing model output`
        });
      }
    }
  });
  
  // Check for final response
  const hasFinalResponse = traceGroup.tasks.some(task => 
    task.title && task.title.includes('Final Response')
  );
  
  if (traceGroup.isComplete && !hasFinalResponse) {
    issues.push({
      severity: 'warning',
      message: 'Trace is marked as complete but has no final response task'
    });
  }
  
  return issues;
}

/**
 * Helper function to initialize debug mode for all trace data
 */
export function enableTraceDebugMode() {
  window.__traceDebugMode = true;
  
  // Patch console methods to colorize trace output
  console.traceInfo = (message, data) => logTrace('trace', data, { label: message });
  console.traceStep = (step, data) => logTrace('step', data, { label: `Step ${step}` });
  console.traceWarning = (message, data) => logTrace('warning', data, { label: message });
  console.traceError = (message, data) => logTrace('error', data, { label: message });
  
  // Listen for trace events
  document.addEventListener('agentTraceUpdated', (event) => {
    if (window.__traceDebugMode) {
      console.traceInfo(`Trace Updated: ${event.detail.nodeId}`, event.detail.traceGroup);
    }
  });
  
  // Return disable function
  return () => {
    window.__traceDebugMode = false;
    delete console.traceInfo;
    delete console.traceStep;
    delete console.traceWarning;
    delete console.traceError;
  };
}

/**
 * Initialize global trace debug helpers
 */
export function initGlobalTraceDebugHelpers() {
  // Make helper functions available globally for console debugging
  window.__traceDebug = {
    logTrace,
    extractTasks,
    findTasksByStep,
    findTasksByTitle,
    findTasksByAgent,
    analyzeTraceTiming,
    findLongRunningTasks,
    extractModelInvocations,
    extractKnowledgeBaseLookups,
    extractConversation,
    analyzeRouting,
    analyzeTraceIssues,
    enableDebugMode: enableTraceDebugMode
  };
  
  console.log('%c Trace Debug Helper Initialized', 'background: #4a148c; color: white; padding: 2px 5px; border-radius: 3px;');
  console.log('Access trace debug functions with window.__traceDebug');
  console.log('Example: window.__traceDebug.extractConversation(traceGroup)');
}

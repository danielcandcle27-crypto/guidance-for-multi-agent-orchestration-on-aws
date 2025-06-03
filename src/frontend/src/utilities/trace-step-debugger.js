/**
 * Trace Step Debugger
 * 
 * A utility for step-by-step debugging of agent trace data.
 * This debugger allows you to walk through trace data step by step,
 * inspect the state at each step, and visualize the flow of execution.
 */

import { logTrace, extractTasks, findTasksByStep } from './trace-debug-helper';

// Class for managing trace step debugging
class TraceStepDebugger {
  constructor(traceGroup) {
    this.traceGroup = traceGroup;
    this.currentStepIndex = 0;
    this.currentTaskIndex = 0;
    this.steps = [];
    this.eventListeners = {};
    this.active = false;
    
    // Process the trace group to extract steps for debugging
    this.processTraceGroup();
  }
  
  /**
   * Process the trace group to extract steps for debugging
   * 
   * @private
   */
  processTraceGroup() {
    if (!this.traceGroup || !this.traceGroup.tasks || !Array.isArray(this.traceGroup.tasks)) {
      console.error('Invalid trace group provided to TraceStepDebugger');
      return;
    }
    
    // Group tasks by step number
    const tasksByStep = {};
    this.traceGroup.tasks.forEach(task => {
      // For special tasks with no step number, use 0
      const stepNumber = task.stepNumber || 0;
      
      if (!tasksByStep[stepNumber]) {
        tasksByStep[stepNumber] = [];
      }
      
      tasksByStep[stepNumber].push(task);
    });
    
    // Sort steps by step number
    const sortedSteps = Object.keys(tasksByStep)
      .map(Number)
      .sort((a, b) => a - b);
      
    // Create step objects
    sortedSteps.forEach(stepNumber => {
      // Sort tasks within each step by timestamp
      const tasks = tasksByStep[stepNumber].sort((a, b) => a.timestamp - b.timestamp);
      
      // Add to steps array
      this.steps.push({
        stepNumber: stepNumber,
        tasks: tasks,
        title: tasks[0].title || `Step ${stepNumber}`,
        timestamp: tasks[0].timestamp,
        completed: true // Assume all steps are completed since this is for replay
      });
    });
    
    // If we have steps, set the current step and task
    if (this.steps.length > 0) {
      this.currentStepIndex = 0;
      this.currentTaskIndex = 0;
    }
  }
  
  /**
   * Get the current step
   * 
   * @returns {Object|null} - Current step or null if no steps
   */
  getCurrentStep() {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      return this.steps[this.currentStepIndex];
    }
    return null;
  }
  
  /**
   * Get the current task
   * 
   * @returns {Object|null} - Current task or null if no task available
   */
  getCurrentTask() {
    const currentStep = this.getCurrentStep();
    if (currentStep && this.currentTaskIndex >= 0 && this.currentTaskIndex < currentStep.tasks.length) {
      return currentStep.tasks[this.currentTaskIndex];
    }
    return null;
  }
  
  /**
   * Move to the next task
   * 
   * @returns {boolean} - True if moved to next task, false if at end
   */
  nextTask() {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return false;
    
    // Check if we can move to the next task in the current step
    if (this.currentTaskIndex < currentStep.tasks.length - 1) {
      this.currentTaskIndex++;
      this._emitEvent('taskChanged', this.getCurrentTask());
      return true;
    }
    
    // If we're at the end of tasks in the current step, try to move to the next step
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.currentTaskIndex = 0;
      this._emitEvent('stepChanged', this.getCurrentStep());
      this._emitEvent('taskChanged', this.getCurrentTask());
      return true;
    }
    
    // We're at the end
    this._emitEvent('end');
    return false;
  }
  
  /**
   * Move to the previous task
   * 
   * @returns {boolean} - True if moved to previous task, false if at beginning
   */
  previousTask() {
    // Check if we can move to the previous task in the current step
    if (this.currentTaskIndex > 0) {
      this.currentTaskIndex--;
      this._emitEvent('taskChanged', this.getCurrentTask());
      return true;
    }
    
    // If we're at the beginning of tasks in the current step, try to move to the previous step
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      const prevStep = this.getCurrentStep();
      this.currentTaskIndex = prevStep.tasks.length - 1;
      this._emitEvent('stepChanged', prevStep);
      this._emitEvent('taskChanged', this.getCurrentTask());
      return true;
    }
    
    // We're at the beginning
    return false;
  }
  
  /**
   * Move to the next step
   * 
   * @returns {boolean} - True if moved to next step, false if at end
   */
  nextStep() {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.currentTaskIndex = 0;
      this._emitEvent('stepChanged', this.getCurrentStep());
      this._emitEvent('taskChanged', this.getCurrentTask());
      return true;
    }
    
    // We're at the end
    this._emitEvent('end');
    return false;
  }
  
  /**
   * Move to the previous step
   * 
   * @returns {boolean} - True if moved to previous step, false if at beginning
   */
  previousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.currentTaskIndex = 0;
      this._emitEvent('stepChanged', this.getCurrentStep());
      this._emitEvent('taskChanged', this.getCurrentTask());
      return true;
    }
    
    // We're at the beginning
    return false;
  }
  
  /**
   * Jump to a specific step
   * 
   * @param {number} stepNumber - Step number to jump to
   * @returns {boolean} - True if successfully jumped to step, false otherwise
   */
  jumpToStep(stepNumber) {
    const stepIndex = this.steps.findIndex(step => step.stepNumber === stepNumber);
    if (stepIndex !== -1) {
      this.currentStepIndex = stepIndex;
      this.currentTaskIndex = 0;
      this._emitEvent('stepChanged', this.getCurrentStep());
      this._emitEvent('taskChanged', this.getCurrentTask());
      return true;
    }
    return false;
  }
  
  /**
   * Reset the debugger to the beginning
   */
  reset() {
    this.currentStepIndex = 0;
    this.currentTaskIndex = 0;
    this._emitEvent('reset');
    this._emitEvent('stepChanged', this.getCurrentStep());
    this._emitEvent('taskChanged', this.getCurrentTask());
  }
  
  /**
   * Start automatic playback of steps
   * 
   * @param {number} interval - Interval between steps in milliseconds
   */
  start(interval = 1000) {
    if (this.active) return;
    
    this.active = true;
    this._emitEvent('started');
    
    this._playbackInterval = setInterval(() => {
      const hasNext = this.nextTask();
      if (!hasNext) {
        this.stop();
      }
    }, interval);
  }
  
  /**
   * Stop automatic playback
   */
  stop() {
    if (!this.active) return;
    
    this.active = false;
    clearInterval(this._playbackInterval);
    this._emitEvent('stopped');
  }
  
  /**
   * Add event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    this.eventListeners[event].push(listener);
    return this;
  }
  
  /**
   * Remove event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    if (!this.eventListeners[event]) return this;
    
    this.eventListeners[event] = this.eventListeners[event].filter(l => l !== listener);
    return this;
  }
  
  /**
   * Emit an event
   * 
   * @private
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  _emitEvent(event, data) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event].forEach(listener => {
      try {
        listener(data);
      } catch (e) {
        console.error(`Error in trace debugger event listener for ${event}:`, e);
      }
    });
  }
  
  /**
   * Get a summary of the current state
   * 
   * @returns {Object} - Current state summary
   */
  getStateSummary() {
    const currentStep = this.getCurrentStep();
    const currentTask = this.getCurrentTask();
    
    return {
      totalSteps: this.steps.length,
      currentStepIndex: this.currentStepIndex,
      currentTaskIndex: this.currentTaskIndex,
      currentStepNumber: currentStep?.stepNumber,
      currentTaskTitle: currentTask?.title,
      isFirst: this.currentStepIndex === 0 && this.currentTaskIndex === 0,
      isLast: this.currentStepIndex === this.steps.length - 1 && 
              this.currentTaskIndex === (currentStep?.tasks.length || 1) - 1,
      isPlaying: this.active
    };
  }
}

/**
 * Create a trace visualization element for DOM display
 * 
 * @param {Object} traceGroup - The trace group to visualize
 * @returns {HTMLElement} - The visualization element
 */
function createTraceVisualization(traceGroup) {
  // Create container element
  const container = document.createElement('div');
  container.className = 'trace-visualization';
  container.style.cssText = `
    font-family: monospace;
    background-color: #f5f5f5;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #ddd;
    max-width: 100%;
    overflow: auto;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.className = 'trace-header';
  header.style.cssText = `
    font-weight: bold;
    font-size: 16px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  
  const title = document.createElement('span');
  title.textContent = traceGroup.originalAgentType || traceGroup.agentId || 'Trace';
  
  const taskCount = document.createElement('span');
  taskCount.style.cssText = `
    font-size: 12px;
    color: #666;
  `;
  taskCount.textContent = `${traceGroup.tasks.length} tasks`;
  
  header.appendChild(title);
  header.appendChild(taskCount);
  container.appendChild(header);
  
  // Create steps container
  const stepsContainer = document.createElement('div');
  stepsContainer.className = 'trace-steps';
  
  // Create step entries
  const tasksByStep = {};
  traceGroup.tasks.forEach(task => {
    const stepNumber = task.stepNumber || 0;
    
    if (!tasksByStep[stepNumber]) {
      tasksByStep[stepNumber] = [];
    }
    
    tasksByStep[stepNumber].push(task);
  });
  
  // Sort steps by step number
  const sortedSteps = Object.keys(tasksByStep)
    .map(Number)
    .sort((a, b) => a - b);
    
  // Create step elements
  sortedSteps.forEach(stepNumber => {
    // Skip step 0, which is typically special tasks
    if (stepNumber === 0 && sortedSteps.length > 1) return;
    
    // Sort tasks within each step by timestamp
    const tasks = tasksByStep[stepNumber].sort((a, b) => a.timestamp - b.timestamp);
    
    // Create step element
    const stepElement = document.createElement('div');
    stepElement.className = 'trace-step';
    stepElement.dataset.stepNumber = stepNumber;
    stepElement.style.cssText = `
      margin-bottom: 8px;
      border-left: 3px solid #2196F3;
      padding-left: 8px;
    `;
    
    // Create step header
    const stepHeader = document.createElement('div');
    stepHeader.className = 'step-header';
    stepHeader.style.cssText = `
      font-weight: bold;
      cursor: pointer;
      padding: 4px;
      background-color: #e3f2fd;
    `;
    stepHeader.textContent = tasks[0]?.title || `Step ${stepNumber}`;
    
    // Create step content
    const stepContent = document.createElement('div');
    stepContent.className = 'step-content';
    stepContent.style.cssText = `
      padding: 4px;
      display: none;
    `;
    
    // Add tasks to step content
    tasks.forEach((task, index) => {
      const taskElement = document.createElement('div');
      taskElement.className = 'trace-task';
      taskElement.style.cssText = `
        padding: 4px;
        border-bottom: 1px solid #e0e0e0;
        ${index === tasks.length - 1 ? 'border-bottom: none;' : ''}
      `;
      
      // Add task content
      const taskContent = document.createElement('div');
      taskContent.className = 'task-content';
      
      if (typeof task.content === 'string') {
        taskContent.textContent = task.content.slice(0, 100) + 
                                 (task.content.length > 100 ? '...' : '');
      } else if (task.content) {
        taskContent.textContent = JSON.stringify(task.content).slice(0, 100) + '...';
      } else {
        taskContent.textContent = '(No content)';
      }
      
      taskElement.appendChild(taskContent);
      
      // Add timestamp
      const timestamp = document.createElement('div');
      timestamp.className = 'task-timestamp';
      timestamp.style.cssText = `
        font-size: 10px;
        color: #666;
        margin-top: 2px;
      `;
      
      const date = new Date(task.timestamp);
      timestamp.textContent = `${date.toLocaleTimeString()}.${String(date.getMilliseconds()).padStart(3, '0')}`;
      
      taskElement.appendChild(timestamp);
      
      // If there are subtasks, add them
      if (task.subTasks && task.subTasks.length > 0) {
        const subtasksToggle = document.createElement('div');
        subtasksToggle.className = 'subtasks-toggle';
        subtasksToggle.style.cssText = `
          margin-top: 4px;
          font-size: 11px;
          color: #2196F3;
          cursor: pointer;
        `;
        subtasksToggle.textContent = `${task.subTasks.length} subtasks`;
        
        const subtasksContainer = document.createElement('div');
        subtasksContainer.className = 'subtasks-container';
        subtasksContainer.style.cssText = `
          margin-left: 12px;
          display: none;
          padding-top: 4px;
        `;
        
        task.subTasks.forEach(subtask => {
          const subtaskElement = document.createElement('div');
          subtaskElement.className = 'trace-subtask';
          subtaskElement.style.cssText = `
            padding: 2px 4px;
            margin-bottom: 2px;
            font-size: 11px;
            background-color: #f9f9f9;
          `;
          
          subtaskElement.textContent = subtask.title || '(Untitled subtask)';
          
          subtasksContainer.appendChild(subtaskElement);
        });
        
        subtasksToggle.addEventListener('click', () => {
          const isVisible = subtasksContainer.style.display === 'block';
          subtasksContainer.style.display = isVisible ? 'none' : 'block';
          subtasksToggle.textContent = `${task.subTasks.length} subtasks ${isVisible ? '' : '(expanded)'}`;
        });
        
        taskElement.appendChild(subtasksToggle);
        taskElement.appendChild(subtasksContainer);
      }
      
      stepContent.appendChild(taskElement);
    });
    
    // Add click handler to toggle step content
    stepHeader.addEventListener('click', () => {
      const isVisible = stepContent.style.display === 'block';
      stepContent.style.display = isVisible ? 'none' : 'block';
      stepElement.style.borderLeft = isVisible ? 
        '3px solid #2196F3' : 
        '3px solid #4CAF50';
    });
    
    stepElement.appendChild(stepHeader);
    stepElement.appendChild(stepContent);
    stepsContainer.appendChild(stepElement);
  });
  
  // Add special tasks (step 0) to the end if they exist
  if (tasksByStep[0] && tasksByStep[0].length > 0) {
    const specialTasks = tasksByStep[0].sort((a, b) => a.timestamp - b.timestamp);
    
    // Create special tasks container
    const specialElement = document.createElement('div');
    specialElement.className = 'trace-special';
    specialElement.style.cssText = `
      margin-top: 12px;
      border-left: 3px solid #9C27B0;
      padding-left: 8px;
    `;
    
    // Create special header
    const specialHeader = document.createElement('div');
    specialHeader.className = 'special-header';
    specialHeader.style.cssText = `
      font-weight: bold;
      cursor: pointer;
      padding: 4px;
      background-color: #f3e5f5;
    `;
    specialHeader.textContent = 'Special Tasks';
    
    // Create special content
    const specialContent = document.createElement('div');
    specialContent.className = 'special-content';
    specialContent.style.cssText = `
      padding: 4px;
      display: none;
    `;
    
    // Add special tasks
    specialTasks.forEach((task, index) => {
      const taskElement = document.createElement('div');
      taskElement.className = 'trace-task';
      taskElement.style.cssText = `
        padding: 4px;
        border-bottom: 1px solid #e0e0e0;
        ${index === specialTasks.length - 1 ? 'border-bottom: none;' : ''}
      `;
      
      // Add task title
      const taskTitle = document.createElement('div');
      taskTitle.className = 'task-title';
      taskTitle.style.cssText = `
        font-weight: bold;
      `;
      taskTitle.textContent = task.title || '(Untitled task)';
      
      taskElement.appendChild(taskTitle);
      
      // Add task content
      if (task.content) {
        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        
        if (typeof task.content === 'string') {
          taskContent.textContent = task.content.slice(0, 100) + 
                                  (task.content.length > 100 ? '...' : '');
        } else {
          taskContent.textContent = JSON.stringify(task.content).slice(0, 100) + '...';
        }
        
        taskElement.appendChild(taskContent);
      }
      
      specialContent.appendChild(taskElement);
    });
    
    // Add click handler to toggle special content
    specialHeader.addEventListener('click', () => {
      const isVisible = specialContent.style.display === 'block';
      specialContent.style.display = isVisible ? 'none' : 'block';
      specialElement.style.borderLeft = isVisible ? 
        '3px solid #9C27B0' : 
        '3px solid #E91E63';
    });
    
    specialElement.appendChild(specialHeader);
    specialElement.appendChild(specialContent);
    stepsContainer.appendChild(specialElement);
  }
  
  container.appendChild(stepsContainer);
  
  return container;
}

/**
 * Create a trace debugger UI
 * 
 * @param {Object} traceGroup - The trace group to debug
 * @param {HTMLElement} container - DOM element to attach the UI to
 * @returns {TraceStepDebugger} - The debugger instance
 */
function createTraceDebuggerUI(traceGroup, container) {
  // Create the debugger instance
  const debuggerInstance = new TraceStepDebugger(traceGroup);
  
  // Create UI container
  const uiContainer = document.createElement('div');
  uiContainer.className = 'trace-debugger-ui';
  uiContainer.style.cssText = `
    font-family: sans-serif;
    background-color: #f5f5f5;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #ddd;
    max-width: 100%;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.className = 'debugger-header';
  header.style.cssText = `
    font-weight: bold;
    font-size: 16px;
    margin-bottom: 12px;
  `;
  header.textContent = `Trace Debugger: ${traceGroup.originalAgentType || traceGroup.agentId || 'Unknown Agent'}`;
  uiContainer.appendChild(header);
  
  // Create controls
  const controls = document.createElement('div');
  controls.className = 'debugger-controls';
  controls.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  `;
  
  // Create navigation buttons
  const createButton = (text, onClick) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      margin-right: 8px;
      padding: 6px 12px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    button.addEventListener('click', onClick);
    return button;
  };
  
  const resetButton = createButton('Reset', () => debuggerInstance.reset());
  controls.appendChild(resetButton);
  
  const prevStepButton = createButton('< Step', () => debuggerInstance.previousStep());
  controls.appendChild(prevStepButton);
  
  const prevTaskButton = createButton('< Task', () => debuggerInstance.previousTask());
  controls.appendChild(prevTaskButton);
  
  // Create play/pause button
  const playButton = document.createElement('button');
  playButton.style.cssText = `
    margin-right: 8px;
    padding: 6px 12px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    width: 100px;
  `;
  playButton.textContent = 'Play';
  playButton.addEventListener('click', () => {
    if (debuggerInstance.active) {
      debuggerInstance.stop();
    } else {
      debuggerInstance.start();
    }
  });
  controls.appendChild(playButton);
  
  const nextTaskButton = createButton('Task >', () => debuggerInstance.nextTask());
  controls.appendChild(nextTaskButton);
  
  const nextStepButton = createButton('Step >', () => debuggerInstance.nextStep());
  controls.appendChild(nextStepButton);
  
  uiContainer.appendChild(controls);
  
  // Create status display
  const status = document.createElement('div');
  status.className = 'debugger-status';
  status.style.cssText = `
    background-color: #e3f2fd;
    padding: 8px;
    border-radius: 4px;
    margin-bottom: 12px;
    font-family: monospace;
  `;
  uiContainer.appendChild(status);
  
  // Create task display
  const taskDisplay = document.createElement('div');
  taskDisplay.className = 'task-display';
  taskDisplay.style.cssText = `
    background-color: white;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #ddd;
    max-height: 300px;
    overflow-y: auto;
    font-family: monospace;
    white-space: pre-wrap;
  `;
  uiContainer.appendChild(taskDisplay);
  
  // Function to update UI based on current state
  const updateUI = () => {
    const state = debuggerInstance.getStateSummary();
    const currentStep = debuggerInstance.getCurrentStep();
    const currentTask = debuggerInstance.getCurrentTask();
    
    // Update status
    status.textContent = `Step ${currentStep?.stepNumber || 0}: ${currentTask?.title || 'No task'} (${state.currentStepIndex + 1}/${state.totalSteps}, ${state.currentTaskIndex + 1}/${currentStep?.tasks.length || 0})`;
    
    // Update play button
    playButton.textContent = state.isPlaying ? 'Pause' : 'Play';
    playButton.style.backgroundColor = state.isPlaying ? '#F44336' : '#4CAF50';
    
    // Update task display
    taskDisplay.innerHTML = '';
    
    if (currentTask) {
      const taskTitle = document.createElement('div');
      taskTitle.style.cssText = `
        font-weight: bold;
        margin-bottom: 8px;
      `;
      taskTitle.textContent = currentTask.title || 'Untitled Task';
      taskDisplay.appendChild(taskTitle);
      
      // Add task content
      if (currentTask.content) {
        const contentPre = document.createElement('pre');
        contentPre.style.cssText = `
          margin: 0;
          padding: 0;
        `;
        
        if (typeof currentTask.content === 'string') {
          contentPre.textContent = currentTask.content;
        } else {
          contentPre.textContent = JSON.stringify(currentTask.content, null, 2);
        }
        
        taskDisplay.appendChild(contentPre);
      } else {
        const noContent = document.createElement('div');
        noContent.textContent = '(No content)';
        noContent.style.color = '#666';
        taskDisplay.appendChild(noContent);
      }
      
      // Add subtasks if available
      if (currentTask.subTasks && currentTask.subTasks.length > 0) {
        const subtasksHeader = document.createElement('div');
        subtasksHeader.style.cssText = `
          font-weight: bold;
          margin-top: 12px;
          margin-bottom: 4px;
        `;
        subtasksHeader.textContent = `Subtasks (${currentTask.subTasks.length})`;
        taskDisplay.appendChild(subtasksHeader);
        
        const subtasksList = document.createElement('ul');
        subtasksList.style.cssText = `
          margin: 0;
          padding-left: 20px;
        `;
        
        currentTask.subTasks.forEach(subtask => {
          const subtaskItem = document.createElement('li');
          subtaskItem.textContent = subtask.title || 'Untitled Subtask';
          subtasksList.appendChild(subtaskItem);
        });
        
        taskDisplay.appendChild(subtasksList);
      }
    } else {
      taskDisplay.textContent = 'No task available';
    }
    
    // Update button states
    prevStepButton.disabled = state.isFirst;
    prevTaskButton.disabled = state.isFirst;
    nextStepButton.disabled = state.isLast;
    nextTaskButton.disabled = state.isLast;
    
    prevStepButton.style.opacity = state.isFirst ? '0.5' : '1';
    prevTaskButton.style.opacity = state.isFirst ? '0.5' : '1';
    nextStepButton.style.opacity = state.isLast ? '0.5' : '1';
    nextTaskButton.style.opacity = state.isLast ? '0.5' : '1';
  };
  
  // Register event listeners
  debuggerInstance.on('taskChanged', updateUI);
  debuggerInstance.on('stepChanged', updateUI);
  debuggerInstance.on('reset', updateUI);
  debuggerInstance.on('started', updateUI);
  debuggerInstance.on('stopped', updateUI);
  debuggerInstance.on('end', () => {
    // Auto-stop at the end
    debuggerInstance.stop();
    updateUI();
  });
  
  // Initial UI update
  updateUI();
  
  // Attach to container
  if (container) {
    container.appendChild(uiContainer);
  } else {
    document.body.appendChild(uiContainer);
  }
  
  return debuggerInstance;
}

/**
 * Visualize a trace execution path in the console
 * 
 * @param {Object} traceGroup - The trace group to visualize
 */
function visualizeTraceExecution(traceGroup) {
  if (!traceGroup || !traceGroup.tasks || !Array.isArray(traceGroup.tasks)) {
    console.error('Invalid trace group provided to visualizeTraceExecution');
    return;
  }
  
  // Sort tasks by timestamp
  const sortedTasks = [...traceGroup.tasks].sort((a, b) => a.timestamp - b.timestamp);
  
  // Define edge colors for different connections
  const colors = {
    'routing-classifier': '#4CAF50',
    'supervisor-agent': '#9C27B0',
    'order-mgmt-agent': '#795548',
    'product-rec-agent': '#2196F3',
    'personalization-agent': '#E91E63',
    'ts-agent': '#FF9800',
    'customer': '#607D8B'
  };
  
  console.group('Trace Execution Visualization');
  console.log(`Agent: ${traceGroup.originalAgentType || traceGroup.agentId || 'Unknown'}`);
  console.log(`Tasks: ${sortedTasks.length}`);
  console.log(`Duration: ${((traceGroup.lastUpdateTime - traceGroup.startTime) / 1000).toFixed(2)}s`);
  
  // Print each task with timestamp and appropriate styling
  sortedTasks.forEach((task, index) => {
    const agentId = task._agentId || 'unknown';
    const color = colors[agentId] || '#333333';
    
    const timestamp = new Date(task.timestamp);
    const formattedTime = `${timestamp.toLocaleTimeString()}.${String(timestamp.getMilliseconds()).padStart(3, '0')}`;
    
    console.groupCollapsed(`%c${index + 1}. ${task.title || 'Untitled Task'} (${formattedTime})`, 
                         `color: ${color}; font-weight: bold;`);
    
    console.log(`Step: ${task.stepNumber || 'Special'}`);
    
    if (task.content) {
      console.log('Content:', typeof task.content === 'string' ? task.content : task.content);
    }
    
    if (task.subTasks && task.subTasks.length > 0) {
      console.groupCollapsed(`Subtasks (${task.subTasks.length})`);
      
      task.subTasks.forEach((subtask, subIndex) => {
        console.log(`${subIndex + 1}. ${subtask.title || 'Untitled Subtask'}`);
      });
      
      console.groupEnd();
    }
    
    console.groupEnd();
  });
  
  console.groupEnd();
}

// Export needed functions
export { 
  TraceStepDebugger, 
  createTraceVisualization, 
  createTraceDebuggerUI,
  visualizeTraceExecution
};

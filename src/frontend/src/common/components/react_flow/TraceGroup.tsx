/*
 * TraceGroup Component
 * 
 * This React component renders a collapsible UI element that displays execution traces
 * from AI agents in a chat interface. Key features include:
 * 
 * - Displays agent execution traces in an expandable/collapsible format
 * - Shows agent name, LLM model used, execution time and number of steps
 * - Supports nested task and subtask hierarchies with expandable sections
 * - Special handling for Knowledge Base and Action Group operations
 * - Color coding for different agent types
 * - Formats and displays various content types (JSON, plain text, KB responses)
 * - Integrates with workflow diagrams via custom events
 * - Supports auto-expansion mode for workflow integration
 */
import React, { useState, useEffect } from 'react';
import { TraceGroup as TraceGroupType, Task } from '../../../utilities/traceParser';
import { collaboratorToNodeId, normalizeTraceGroup } from '../../../utilities/agentTraceStorage';
import { getAgentColor } from './FlowUtils';
import './FlowComponents.css';

interface TraceGroupProps {
  traceGroup: TraceGroupType;
  hideTitle?: boolean; // Optional prop to hide the title (for workflow diagram)
  autoExpand?: boolean; // Optional prop to auto-expand content and skip dropdown interaction
}

// This is a wrapper component to render trace groups in the chat UI
const TraceGroup: React.FC<TraceGroupProps> = ({ traceGroup, hideTitle = false, autoExpand = false }) => {
  const [expanded, setExpanded] = useState(autoExpand);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>(
    // When autoExpand is true, auto-expand the first task
    autoExpand && traceGroup?.tasks?.length > 0 ? { 0: false } : {}
  );
  
  // Track expanded state of subtasks
  const [expandedSubTasks, setExpandedSubTasks] = useState<Record<string, boolean>>({});
  
  // State for dynamic elapsed time displays
  const [elapsedTimeState, setElapsedTimeState] = useState<{
    totalTime: string;
    taskTimes: Record<number, string>;
    subtaskTimes: Record<string, string>;
    lastUpdateTime: number;
  }>({
    totalTime: "0.00",
    taskTimes: {},
    subtaskTimes: {},
    lastUpdateTime: Date.now()
  });
  
  // Process the trace group once for efficiency
  const processedTraceGroupRef = normalizeTraceGroup(traceGroup);
  
  // Unified function to calculate accumulated time for all tasks and subtasks
  const calculateAccumulatedTimeUnified = (isComplete: boolean = false): string => {
    let totalTime = 0;
    
    // Process main tasks
    if (processedTraceGroupRef?.tasks && Array.isArray(processedTraceGroupRef.tasks)) {
      processedTraceGroupRef.tasks
        .filter(task => task.stepNumber > 0)
        .forEach(task => {
          // First, extract time from task title
          const timeMatch = task.title.match(/\((\d+\.\d+)s\)/);
          const stepTime = timeMatch ? parseFloat(timeMatch[1]) : 0;
          totalTime += stepTime;
          
          // Then add all subtask times if they exist
          if (task.subTasks && Array.isArray(task.subTasks)) {
            task.subTasks.forEach(subtask => {
              const subTimeMatch = subtask.title.match(/\((\d+\.\d+)s\)/);
              const subStepTime = subTimeMatch ? parseFloat(subTimeMatch[1]) : 0;
              totalTime += subStepTime;
            });
          }
        });
    }
    
    // Return with two decimal places
    return totalTime.toFixed(2);
  };

  // Update elapsed times dynamically with an interval
  useEffect(() => {
    if (!expanded || !processedTraceGroupRef) return;
    
    const isComplete = 'isComplete' in processedTraceGroupRef ? processedTraceGroupRef.isComplete : false;
    
    // Don't update times for completed traces
    if (isComplete && processedTraceGroupRef.finalElapsedTime) {
      // One-time update for completed traces
      const startTime = processedTraceGroupRef.startTime || Date.now();
      const finalTime = processedTraceGroupRef.finalElapsedTime || 
                       ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Calculate accurate accumulated time for all tasks and subtasks             
      const accumulatedTime = calculateAccumulatedTimeUnified(true);
                       
      setElapsedTimeState({
        totalTime: accumulatedTime, // Use accumulated time instead of just elapsed time
        taskTimes: calculateTaskTimes(processedTraceGroupRef.tasks, true),
        subtaskTimes: calculateSubtaskTimes(processedTraceGroupRef.tasks, true),
        lastUpdateTime: Date.now()
      });
      return; // No need for interval for completed traces
    }
    
    // Set up interval for dynamic updates for active traces
    const intervalId = setInterval(() => {
      const startTime = processedTraceGroupRef.startTime || Date.now();
      const currentTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Calculate accurate accumulated time for all tasks and subtasks
      const accumulatedTime = calculateAccumulatedTimeUnified(false);
      
      setElapsedTimeState({
        totalTime: accumulatedTime, // Use accumulated time instead of just elapsed time
        taskTimes: calculateTaskTimes(processedTraceGroupRef.tasks, false),
        subtaskTimes: calculateSubtaskTimes(processedTraceGroupRef.tasks, false),
        lastUpdateTime: Date.now()
      });
    }, 1000); // Update every second
    
    return () => clearInterval(intervalId);
  }, [expanded, processedTraceGroupRef]);
  
  // Helper function to calculate task times dynamically
  const calculateTaskTimes = (tasks: Task[], isComplete: boolean): Record<number, string> => {
    const taskTimes: Record<number, string> = {};
    
    if (!tasks || !Array.isArray(tasks)) return taskTimes;
    
    tasks.forEach((task, index) => {
      // For each task, calculate elapsed time from its timestamp to now (or next task)
      const taskStartTime = task.timestamp;
      let taskEndTime;
      
      if (index < tasks.length - 1) {
        // Use the next task's timestamp as the end time
        taskEndTime = tasks[index + 1].timestamp;
      } else {
        // For the last task, use current time if not complete, otherwise use last update time
        taskEndTime = isComplete ? (processedTraceGroupRef.lastUpdateTime || Date.now()) : Date.now();
      }
      
      const taskElapsedTime = ((taskEndTime - taskStartTime) / 1000).toFixed(2);
      taskTimes[index] = taskElapsedTime;
    });
    
    return taskTimes;
  };
  
  // Helper function to calculate subtask times dynamically
  const calculateSubtaskTimes = (tasks: Task[], isComplete: boolean): Record<string, string> => {
    const subtaskTimes: Record<string, string> = {};
    
    if (!tasks || !Array.isArray(tasks)) return subtaskTimes;
    
    tasks.forEach((task, taskIndex) => {
      if (task.subTasks && Array.isArray(task.subTasks)) {
        task.subTasks.forEach((subtask, subtaskIndex) => {
          // For each subtask, calculate elapsed time from its timestamp
          const subtaskStartTime = subtask.timestamp;
          let subtaskEndTime;
          
          if (subtaskIndex < task.subTasks!.length - 1) {
            // Use the next subtask's timestamp as the end time
            subtaskEndTime = task.subTasks![subtaskIndex + 1].timestamp;
          } else {
            // For the last subtask, use current time or last update time
            subtaskEndTime = isComplete ? 
                            (processedTraceGroupRef.lastUpdateTime || Date.now()) : 
                            Date.now();
          }
          
          const subtaskElapsedTime = ((subtaskEndTime - subtaskStartTime) / 1000).toFixed(2);
          subtaskTimes[`${taskIndex}-${subtaskIndex}`] = subtaskElapsedTime;
        });
      }
    });
    
    return subtaskTimes;
  };
  
  // Skip invalid trace groups
  if (!processedTraceGroupRef || !processedTraceGroupRef.tasks || 
      !Array.isArray(processedTraceGroupRef.tasks) || processedTraceGroupRef.tasks.length === 0) {
    return null;
  }

  // Toggle expanded state
  const toggleExpanded = () => {
    const newExpandedState = !expanded;
    setExpanded(newExpandedState);
    
    // Dispatch an event when a trace group is expanded
    // This will be picked up by the flow diagram to activate animations
    if (newExpandedState && traceGroup) {
      console.log(`TraceGroup expanded: ${traceGroup.originalAgentType || 'unknown'}`);
      
      // We no longer calculate elapsed time on first click, since we initialize it
      // in the useState hook above to prevent recalculation on expansion
      
      const traceGroupExpandedEvent = new CustomEvent('traceGroupExpanded', {
        detail: {
          traceGroup,
          timestamp: Date.now()
        }
      });
      document.dispatchEvent(traceGroupExpandedEvent);
    }
  };

  // Effect to notify the flow panel about this trace group when it's first rendered
  useEffect(() => {
    if (traceGroup && (autoExpand || expanded)) {
      // When trace group is auto-expanded or manually expanded, notify flow diagram
      const nodeId = traceGroup.agentId || 
                   (traceGroup.originalAgentType ? collaboratorToNodeId(traceGroup.originalAgentType) : null);
      
      // Special handling for supervisor agent to ensure proper detection
      const isSupervisor = traceGroup.originalAgentType && 
                         (traceGroup.originalAgentType.toLowerCase().includes('super') || 
                          traceGroup.originalAgentType === 'Supervisor');
      
      // If this is for supervisor, ensure we're using the correct node ID
      const finalNodeId = isSupervisor ? 'supervisor-agent' : nodeId;
      
      if (finalNodeId) {
        console.log(`TraceGroup mounted/expanded: ${traceGroup.originalAgentType || 'unknown'} -> ${finalNodeId}`);
        const traceGroupActivateEvent = new CustomEvent('agentNodeUpdate', {
          detail: {
            nodeId: finalNodeId,
            traceGroup,
            isProcessing: true,
            source: 'trace-group'
          }
        });
        document.dispatchEvent(traceGroupActivateEvent);
      }
    }
  }, [traceGroup, expanded, autoExpand]);

  // Toggle expanded state for a task
  const toggleTaskExpanded = (taskIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => ({
      ...prev,
      [taskIndex]: !prev[taskIndex]
    }));
  };
  
  // Toggle expanded state for a subtask
  const toggleSubTaskExpanded = (taskIndex: number, subTaskIndex: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${taskIndex}-${subTaskIndex}`;
    setExpandedSubTasks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Get the relevant information from the processed trace group
  // Extract agent name and hardcode LLM for each agent type
  // Get the agent type directly from the trace - this is the key fix to ensure proper naming
  const agentType = processedTraceGroupRef.originalAgentType || 'Unknown';
  
  // Format agent name based on its proper type
  let agentName = '';
  
  // Routing classifier is now removed - all traces go under Supervisor
  if (agentType.includes('Supervisor') || agentType === 'Supervisor') {
    agentName = 'Supervisor';
  } else if (agentType.includes('ProductRecommendation') || agentType.toLowerCase().includes('product')) {
    agentName = 'Product Recommendation';
  } else if (agentType.includes('Troubleshoot') || agentType.toLowerCase().includes('trouble')) {
    agentName = 'Troubleshoot';
  } else if (agentType.includes('Personalization') || agentType.toLowerCase().includes('personal')) {
    agentName = 'Personalization';
  } else if (agentType.includes('OrderManagement') || agentType.toLowerCase().includes('order')) {
    agentName = 'Order Management';
  } else {
    // Fall back to using the agent type as is, or the dropdown title as a last resort
    agentName = agentType || (processedTraceGroupRef.dropdownTitle?.split('(')[0]?.trim() || 'Unknown Agent');
  }

  // Hardcode the LLM for each agent type
  const getHardcodedLLM = (agentType: string | undefined): string => {
    if (!agentType) return 'Claude 3';
    
    const normalizedType = agentType.toLowerCase();
    
    if (normalizedType.includes('super') || normalizedType === 'supervisor') {
      return 'Nova Pro';
    } else if (normalizedType.includes('routing') || normalizedType.includes('classifier')) {
      return 'Nova Micro';
    } else if (normalizedType.includes('product') || normalizedType.includes('recommendation')) {
      return 'Nova Lite';
    } else if (normalizedType.includes('trouble')) {
      return 'Nova Micro';
    } else if (normalizedType.includes('personal')) {
      return 'Nova Lite';
    } else if (normalizedType.includes('order') || normalizedType.includes('management')) {
      return 'Nova Micro';
    }
    
    return 'Claude 3';
  };
  
  // Create static title with agent name and hardcoded LLM
  const hardcodedLLM = getHardcodedLLM(traceGroup.originalAgentType);
  const title = `${agentName} (${hardcodedLLM})`;
  const tasks = traceGroup.tasks || [];
  const isComplete = 'isComplete' in traceGroup ? traceGroup.isComplete : false;
  
  // Calculate elapsed time - use dynamic value from elapsed time state
  // This allows the time to update dynamically as processing continues
  let totalElapsedSeconds = elapsedTimeState.totalTime || "0.00";
  
  // Calculate accumulated time from all tasks and subtasks using the unified function
  const accumulatedTime = calculateAccumulatedTimeUnified();
  
  // Find the maximum step number instead of just counting array length
  const stepCount = processedTraceGroupRef.tasks.length > 0
    ? Math.max(...processedTraceGroupRef.tasks
        .filter(task => task.stepNumber > 0)
        .map(task => task.stepNumber))
    : 0;
  
  // Improved display showing step count and accurate accumulated processing time
  // Using the same calculation for display time as used in the elapsed time state
  const timeDisplay = `${stepCount} steps (${accumulatedTime}s)`;

  // Helper to extract time value from formatted time string
  const extractTimeValue = (timeString: string): number => {
    const match = timeString.match(/\((\d+\.\d+)s\)/);
    return match ? parseFloat(match[1]) : 0;
  };

  // Format trace content for display
  const formatContent = (content: string | object | undefined) => {
    if (!content) return null;

    try {
      // If content is already a string, try to format it
      if (typeof content === 'string') {
        // Special handling for knowledge base responses
        if (content.includes('### KNOWLEDGE BASE RESPONSE ###')) {
          const sections = content.split('---');
          return (
            <div className="kb-response">
              <h4 style={{marginTop: 0, color: '#FF5722', fontWeight: 'bold'}}>Knowledge Base Results</h4>
              {sections.map((section, idx) => {
                // Extract source if available
                const sourceMatch = section.match(/Source: ([^\n]+)/);
                const source = sourceMatch ? sourceMatch[1] : null;
                
                // Remove the header and reference line for cleaner display
                const cleanedSection = section
                  .replace(/### KNOWLEDGE BASE RESPONSE ###/, '')
                  .replace(/Reference \d+:/, '')
                  .replace(/Source: [^\n]+/, '')
                  .trim();
                
                return (
                  <div key={idx} className="kb-section" style={{marginBottom: '10px', padding: '8px', borderLeft: '3px solid #FF5722', backgroundColor: '#FFF3E0'}}>
                    {source && <div style={{fontWeight: 'bold', marginBottom: '4px', fontSize: '12px'}}>Source: {source}</div>}
                    <div style={{whiteSpace: 'pre-wrap'}}>{cleanedSection}</div>
                  </div>
                );
              })}
            </div>
          );
        }
        
        // Check if it's JSON
        if (
          (content.startsWith('{') && content.endsWith('}')) ||
          (content.startsWith('[') && content.endsWith(']'))
        ) {
          try {
            const parsed = JSON.parse(content);
            return <pre className="trace-content-json">{JSON.stringify(parsed, null, 2)}</pre>;
          } catch (e) {
            // Not valid JSON, show as is
            return <pre className="trace-content-text">{content}</pre>;
          }
        }
        // Plain text
        return <pre className="trace-content-text">{content}</pre>;
      }
      // If it's an object, pretty print it
      else {
        return <pre className="trace-content-json">{JSON.stringify(content, null, 2)}</pre>;
      }
    } catch (e) {
      // Fallback if anything goes wrong
      return <div className="trace-content-error">Error formatting content</div>;
    }
  };

  // Direct mapping for agent trace colors
  const mapAgentTypeToColor = (agentType: string | undefined): string => {
    if (!agentType) return '#2196F3'; // Default blue
    
    const normalizedType = agentType.toLowerCase();
    
    if (normalizedType.includes('super') || normalizedType === 'supervisor') {
      return '#9C27B0'; // Purple for SupervisorAgent
    } else if (normalizedType.includes('routing') || normalizedType.includes('classifier') || normalizedType === 'routing_classifier') {
      return '#4CAF50'; // Green for ROUTING_CLASSIFIER
    } else if (normalizedType.includes('product') || normalizedType.includes('recommendation')) {
      return '#2196F3'; // Blue for ProductRecommendationAgent
    } else if (normalizedType.includes('trouble') || normalizedType.includes('ts-agent')) {
      return '#FF9800'; // Orange for TroubleshootAgent
    } else if (normalizedType.includes('personal')) {
      return '#E91E63'; // Pink for PersonalizationAgent
    } else if (normalizedType.includes('order') || normalizedType.includes('management')) {
      return 'brown'; // Brown for OrderManagementAgent
    }
    
    // Fallback to default blue
    return '#2196F3';
  };
  
  // Get the appropriate color for this agent
  const agentColor = mapAgentTypeToColor(processedTraceGroupRef.originalAgentType);
  
  // Create lighter version of the color for task headers
  const lighterColor = agentColor + '22'; // Adding 22 for 13% opacity
  
  return (
    <div className={`trace-group ${expanded ? 'expanded' : ''}`}>
      {/* Only show header if not auto-expanding */}
      {!autoExpand && (
        <div 
          className="trace-group-header" 
          onClick={toggleExpanded}
          style={{ backgroundColor: agentColor, color: 'white', fontWeight: 'bold' }}
        >
          {!hideTitle && <div className="trace-group-title">{title}</div>}
          <div className="trace-group-actions">
            <span className="trace-time-badge" title="Processing time">
              {timeDisplay}
            </span>
            <span className="trace-expand-icon">{expanded ? '▼' : '▶'}</span>
          </div>
        </div>
      )}
      
      {expanded && (
        <div className="trace-group-content">
          {/* Sort tasks by sequence number if available, otherwise use array index for order */}
          {processedTraceGroupRef.tasks
            .sort((a, b) => {
                // If both tasks have sequence numbers, use them for ordering
                if (a._sequenceNumber !== undefined && b._sequenceNumber !== undefined) {
                    return a._sequenceNumber - b._sequenceNumber;
                }
                // Otherwise, try to use timestamps
                return a.timestamp - b.timestamp;
            })
            .map((task, index) => (
              <div 
                key={`${index}-${task.title}`}
                className={`trace-task ${expandedTasks[index] ? 'expanded' : ''}`}
              >
                {/* Handle Final Response tasks for all agent types */}
                {(task.title === 'Final Response' || task.stepNumber === 0 && task.title === 'Final Response') && (
                  <div className="final-response-handler" style={{ display: 'none' }}>
                    {(() => {
                      // When any agent's Final Response task is rendered in the trace dropdown
                      const content = task.content?.toString() || '';
                      const detectionTime = Date.now();
                      
                      if (content && !task._finalResponseDispatched) {
                        task._finalResponseDispatched = true;
                        console.log(`⏱️ [${detectionTime}] TIMING: Final Response detected in ${agentName} trace dropdown - contentLength: ${content.length}`);
                        
                        // For Supervisor agent, dispatch special event for UI rendering
                        if (agentName === 'Supervisor') {
                          console.log(`⏱️ [${detectionTime}] TIMING: Supervisor Final Response - dispatching event`);
                          
                          // Use setTimeout to ensure this runs after the current render cycle
                          setTimeout(() => {
                            const eventTime = Date.now();
                            console.log(`⏱️ [${eventTime}] TIMING: Supervisor Final Response event dispatching (delay: ${eventTime - detectionTime}ms)`);
                            
                            const finalResponseEvent = new CustomEvent('supervisorFinalResponseRendered', {
                              detail: {
                                content: content,
                                traceId: traceGroup.id,
                                timestamp: eventTime,
                                detectionTime: detectionTime,
                                traceGroup: traceGroup
                              }
                            });
                            document.dispatchEvent(finalResponseEvent);
                          }, 0);
                        } else {
                          // For other agents, log the final response but don't dispatch UI events
                          console.log(`⏱️ [${detectionTime}] TIMING: ${agentName} Final Response detected - dispatching event`);
                          
                          // Mark the trace group as having a final response
                          if (traceGroup) {
                            traceGroup.hasFinalResponse = true;
                            traceGroup.finalResponseTimestamp = detectionTime;
                            traceGroup.finalResponseContent = content;
                            // Initialize finalResponseProcessed flag to track UI updates
                            traceGroup.finalResponseProcessed = false;
                            
                            // Add a direct dispatch for non-Supervisor agents as well to speed up rendering
                            setTimeout(() => {
                              const eventTime = Date.now();
                              console.log(`⏱️ [${eventTime}] TIMING: ${agentName} Final Response event dispatching (delay: ${eventTime - detectionTime}ms)`);
                              
                              const finalResponseEvent = new CustomEvent('agentFinalResponseRendered', {
                                detail: {
                                  content: content,
                                  traceId: traceGroup.id,
                                  timestamp: eventTime,
                                  detectionTime: detectionTime,
                                  agentName: agentName,
                                  traceGroup: traceGroup
                                }
                              });
                              document.dispatchEvent(finalResponseEvent);
                            }, 0);
                          }
                        }
                      }
                      return null;
                    })()}
                  </div>
                )}
                <div 
                  className="trace-task-header"
                  onClick={(e) => toggleTaskExpanded(index, e)}
                  style={{ 
                    borderLeft: `4px solid ${agentColor}`,
                    backgroundColor: expandedTasks[index] ? lighterColor : '#f5f5f5',
                    color: agentColor,
                    fontWeight: 'bold'
                  }}
                >
                  <div className="trace-task-title">
                    {task.title.includes("Invoking Model") && task.subTasks && task.subTasks.some(st => st.title.includes("Model Output")) ? (
                      (() => {
                        // Find the Model Output subtask
                        const modelOutputSubtask = task.subTasks.find(st => st.title.includes("Model Output"));
                        // Get the model output time
                        const outputTime = modelOutputSubtask ? extractTimeValue(modelOutputSubtask.title) : 0;
                        // Extract the original time from the task title
                        const originalTime = extractTimeValue(task.title);
                        // Calculate total time 
                        const totalTime = (outputTime + originalTime).toFixed(2);
                        
                        // Replace original time with total time
                        return task.title.replace(/\((\d+\.\d+)s\)/, `(${totalTime}s)`);
                      })()
                    ) : task.title}
                  </div>
                  <div className="trace-task-expand">
                    {expandedTasks[index] ? '−' : '+'}
                  </div>
                </div>
                
{expandedTasks[index] && (
  <div className="trace-task-content" style={{ color: agentColor }}>
    {/* Only show content if it's not a Model invocation or it's a Model invocation without subtasks */}
    {(!task.title.includes("Invoking Model") || !task.subTasks || task.subTasks.length === 0) && 
      formatContent(task.content)}
    
    {/* Render subtasks if they exist */}
    {task.subTasks && task.subTasks.length > 0 && (
      <div className="trace-subtasks">
                        {task.subTasks.map((subtask, subTaskIndex) => (
                          <div 
                            key={`${index}-${subTaskIndex}`}
                            className={`trace-subtask ${expandedSubTasks[`${index}-${subTaskIndex}`] ? 'expanded' : ''}`}
                          >
                            <div 
                              className="trace-subtask-header"
                              onClick={(e) => toggleSubTaskExpanded(index, subTaskIndex, e)}
                              style={{ 
                                borderLeft: `3px solid ${agentColor}`,
                                backgroundColor: expandedSubTasks[`${index}-${subTaskIndex}`] ? lighterColor : '#f9f9f9',
                                color: agentColor,
                                fontWeight: 'normal',
                                fontSize: '0.95em',
                                padding: '8px 12px',
                                marginTop: '5px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                cursor: 'pointer'
                              }}
                            >
                              <div className="trace-subtask-title">
                                {subtask.title}
                              </div>
                              <div className="trace-subtask-expand">
                                {expandedSubTasks[`${index}-${subTaskIndex}`] ? '−' : '+'}
                              </div>
                            </div>
                            
                            {expandedSubTasks[`${index}-${subTaskIndex}`] && (
                              <div 
                                className="trace-subtask-content" 
                                style={{ 
                                  color: agentColor,
                                  padding: '10px 15px',
                                  marginLeft: '10px',
                                  borderLeft: `2px solid ${lighterColor}`,
                                  backgroundColor: '#fafafa'
                                }}
                              >
                                {formatContent(subtask.content)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

export default TraceGroup;

import React, { useState, useEffect, useRef, memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import TraceGroup from './TraceGroup';
import { TraceGroup as TraceGroupType } from '../../../utilities/traceParser';
import { getAgentTrace, storeAgentTrace } from '../../../utilities/agentTraceStorage';
import { getAgentColor } from './FlowUtils';
import { areFlowAnimationsFrozen } from '../../../utilities/killSwitch';
import './FlowComponents.css';

// Global map to track processing state across renders
const nodeProcessingStates = new Map<string, boolean>();

// Enhanced CustomAgentNode component with improved trace detection
const CustomAgentNode = memo(({ id, data, selected }: NodeProps) => {
  // Don't log every render to reduce console noise
  // console.log(`Rendering node ${id}, processing: ${data?.isProcessing}`, data);
  // We no longer need expanded state since we're removing the dropdown functionality
  const [showTrace, setShowTrace] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const initialRender = useRef(true);
  const lastTraceGroup = useRef<TraceGroupType | null>(null);
  
  // Get styling
  const nodeColor = getAgentColor(id);
  const isProcessing = data.isProcessing;
  const processingComplete = data.processingComplete;
  
  // Format node label nicely
  const formatNodeLabel = (id: string) => {
    // Extract just the base name
    const baseName = id.replace('-agent', '')
                     .replace('-', ' ')
                     .replace(/([a-z])([A-Z])/g, '$1 $2'); // add space between camelCase
                     
    // Capitalize each word
    return baseName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Get node label
  const formattedLabel = data.label || formatNodeLabel(id);
  
  // Effect to handle trace content visibility
  useEffect(() => {
    // Check for valid trace content - must have traceGroup with actual tasks
    const hasValidTraceData = data.traceGroup && 
                            data.traceGroup.tasks && 
                            Array.isArray(data.traceGroup.tasks) && 
                            data.traceGroup.tasks.length > 0;
    
    if (hasValidTraceData) {
      console.log(`CustomAgentNode: Received valid trace data for ${id} with ${data.traceGroup.tasks.length} tasks`);
      
      // Store current trace group for comparison
      lastTraceGroup.current = data.traceGroup;
      
      // Force animation class to be applied directly to DOM element
      // This is critical for making the node glow without requiring a click
      if (nodeRef.current) {
        nodeRef.current.classList.add('node-processing');
      }
      
      // If this is not already marked as processing, trigger the animation
      if (!isProcessing) {
        console.log(`CustomAgentNode: Triggering processing animation for ${id}`);
        const processingEvent = new CustomEvent('agentProcessingUpdate', {
          detail: {
            nodeId: id,
            isProcessing: true,
            processingComplete: false
          }
        });
        document.dispatchEvent(processingEvent);
      }
    } else if (data.traceGroup) {
      console.log(`CustomAgentNode: Received trace data for ${id} but it has no tasks, skipping animation`);
    }
    
    // Mark initial render as complete
    initialRender.current = false;
  }, [data.traceGroup, id, isProcessing]);
  
  // Effect to handle trace group updates
  useEffect(() => {
    // Check if we have a valid trace group with tasks
    const hasValidTraceData = data.traceGroup && 
                            data.traceGroup.tasks && 
                            Array.isArray(data.traceGroup.tasks) && 
                            data.traceGroup.tasks.length > 0;
                            
    // When trace group updates, check if it's different from the last one
    if (hasValidTraceData) {
      // Check if we have a new trace group or updated content in existing one
      const isNewTrace = !lastTraceGroup.current || lastTraceGroup.current.id !== data.traceGroup.id;
      const hasNewTasks = lastTraceGroup.current && lastTraceGroup.current.tasks?.length !== data.traceGroup.tasks?.length;
      
      // Special logging for browser node to track task updates
      if (id === 'customer') {
        console.log(`Browser node trace update:`, {
          isNewTrace,
          hasNewTasks,
          taskCount: data.traceGroup.tasks?.length || 0,
          taskTitles: data.traceGroup.tasks?.map(t => t.title)
        });
      }
      
      if (isNewTrace || hasNewTasks) {
        console.log(`CustomAgentNode: Trace group updated for ${id}:`, 
          isNewTrace ? 'New trace ID' : 'Updated tasks');
        
        // Store the updated trace group both in our ref and in persistent storage
        lastTraceGroup.current = data.traceGroup;
        storeAgentTrace(id, data.traceGroup);
        
        // Make sure we're showing trace content
        setShowTrace(true);
        
        // Check if the trace is marked as complete before applying processing animation
        if (data.traceGroup.isComplete) {
          console.log(`🛑 Trace group for ${id} is marked as complete - applying complete style`);
          if (nodeRef.current) {
            nodeRef.current.classList.remove('node-processing');
            nodeRef.current.classList.add('node-complete');
            
            // Dispatch completion event to stop animations
            const completionEvent = new CustomEvent('agentProcessingUpdate', {
              detail: {
                nodeId: id,
                isProcessing: false,
                processingComplete: true
              }
            });
            document.dispatchEvent(completionEvent);
          }
        } else {
          // Force animation class to be applied directly
          if (nodeRef.current) {
            nodeRef.current.classList.add('node-processing');
          }
        }
      }
    } else if (data.traceGroup) {
      console.log(`CustomAgentNode: Trace group for ${id} has no valid tasks, skipping animation update`);
    }
  }, [data.traceGroup, id]);

  // Effect to animate processing state when receiving trace data or when isProcessing changes
  useEffect(() => {
    // Check if animations are frozen before applying/removing animation classes
    const animationsFrozen = areFlowAnimationsFrozen();
    
    // Apply animation based on node state
    if (nodeRef.current) {
      // Handle frozen state - preserve visual state but stop animation
      if (animationsFrozen) {
        // Remove animation classes but preserve visual appearance
        nodeRef.current.classList.remove('node-processing');
        
        // Add appropriate static class based on state
        if (isProcessing) {
          nodeRef.current.classList.add('node-frozen-processing');
        } else if (processingComplete) {
          nodeRef.current.classList.remove('node-frozen-processing');
          nodeRef.current.classList.add('node-complete');
        } else {
          nodeRef.current.classList.remove('node-frozen-processing');
          nodeRef.current.classList.remove('node-complete');
        }
      } else {
        // Normal animation behavior when not frozen
        nodeRef.current.classList.remove('node-frozen-processing');
        
        if (isProcessing) {
          nodeRef.current.classList.add('node-processing');
        } else if (processingComplete) {
          nodeRef.current.classList.remove('node-processing');
          nodeRef.current.classList.add('node-complete');
        } else {
          nodeRef.current.classList.remove('node-processing');
          nodeRef.current.classList.remove('node-complete');
        }
      }
    }

  // Check if we have valid trace data with actual tasks
  const hasValidTraceData = data.traceGroup && 
                          data.traceGroup.tasks && 
                          Array.isArray(data.traceGroup.tasks) && 
                          data.traceGroup.tasks.length > 0;
  
  // If we're receiving valid trace data, ensure the processing indicator is shown
  if (data.showTraceContent && hasValidTraceData && !isProcessing && !processingComplete) {
    // Don't restart processing if trace is marked as complete
    if (data.traceGroup.isComplete) {
      console.log(`🛑 Not starting processing for ${id} - trace is marked as complete`);
      // Instead, mark it as complete
      const completionEvent = new CustomEvent('agentProcessingUpdate', {
        detail: {
          nodeId: id,
          isProcessing: false,
          processingComplete: true
        }
      });
      document.dispatchEvent(completionEvent);
    } else {
      console.log(`Setting processing state for ${id} due to trace data`);
      // We don't modify the prop directly, but dispatch an event to update it
      const processingEvent = new CustomEvent('agentProcessingUpdate', {
        detail: {
          nodeId: id,
          isProcessing: true,
          processingComplete: false
        }
      });
      document.dispatchEvent(processingEvent);
    }
  }
  }, [data.showTraceContent, data.traceGroup, id, isProcessing, processingComplete]);
  
  // Effect to listen for trace updates from other components
  useEffect(() => {
    const handleTraceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.nodeId === id) {
        const updatedTraceGroup = customEvent.detail.traceGroup;
        
        // Check if this is the supervisor node
        const isSupervisorNode = id === 'supervisor-agent';
        
        // Check if animation should be skipped (from noAnimation flag or for supervisor node)
        const skipAnimation = customEvent.detail.noAnimation === true;
        
        // Check if we have a valid trace group with tasks
        const hasValidTraceData = updatedTraceGroup && 
                                updatedTraceGroup.tasks && 
                                Array.isArray(updatedTraceGroup.tasks) && 
                                updatedTraceGroup.tasks.length > 0;
        
        // Only apply animation if there's valid trace data and not explicitly skipped
        // Skip animation if the noAnimation flag is set, especially for supervisor node
        if (hasValidTraceData && 
            !skipAnimation && 
            (!lastTraceGroup.current || lastTraceGroup.current.id !== updatedTraceGroup.id)) {
          // Store the updated trace locally
          lastTraceGroup.current = updatedTraceGroup;
          
          // Update the node's state to show the new trace content
          setShowTrace(true);
          
          // Check if the trace is marked as complete
          if (updatedTraceGroup.isComplete) {
            if (nodeRef.current) {
              // Handle animation based on frozen state
              if (areFlowAnimationsFrozen()) {
                nodeRef.current.classList.remove('node-processing');
                nodeRef.current.classList.remove('node-frozen-processing');
                nodeRef.current.classList.add('node-complete');
              } else {
                nodeRef.current.classList.remove('node-processing');
                nodeRef.current.classList.add('node-complete');
              }
              
              // Dispatch completion event
              const completionEvent = new CustomEvent('agentProcessingUpdate', {
                detail: {
                  nodeId: id,
                  isProcessing: false,
                  processingComplete: true
                }
              });
              document.dispatchEvent(completionEvent);
            }
          } else {
            // Force animation class directly on DOM node
            if (nodeRef.current) {
              
              // Apply appropriate class based on animation freeze state
              if (areFlowAnimationsFrozen()) {
                nodeRef.current.classList.remove('node-processing');
                nodeRef.current.classList.add('node-frozen-processing');
              } else {
                nodeRef.current.classList.add('node-processing');
              }
              
              // For Supervisor node, also dispatch processing event to ensure UI state is updated
              // But only do this if animations aren't being skipped
              if (isSupervisorNode && !skipAnimation) {
                const processingEvent = new CustomEvent('agentProcessingUpdate', {
                  detail: {
                    nodeId: id,
                    isProcessing: true,
                    processingComplete: false
                  }
                });
                document.dispatchEvent(processingEvent);
              }
            }
          }
        }
      }
    };
    
    // Listen for animation freeze state changes
    const handleAnimationFreezeChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const frozen = customEvent.detail?.frozen;
      
      // Apply appropriate classes based on current state and new freeze setting
      if (nodeRef.current) {
        if (frozen) {
          // Freezing animations: replace animated classes with static ones
          if (nodeRef.current.classList.contains('node-processing')) {
            nodeRef.current.classList.remove('node-processing');
            nodeRef.current.classList.add('node-frozen-processing');
          }
        } else {
          // Unfreezing animations: restore animated classes
          if (nodeRef.current.classList.contains('node-frozen-processing')) {
            nodeRef.current.classList.remove('node-frozen-processing');
            if (isProcessing) {
              nodeRef.current.classList.add('node-processing');
            }
          }
        }
      }
    };
    
    // Listen for flow animation reset events
    const handleFlowReset = () => {
      if (nodeRef.current) {
        // Remove all animation classes
        nodeRef.current.classList.remove('node-processing');
        nodeRef.current.classList.remove('node-frozen-processing');
        nodeRef.current.classList.remove('node-complete');
        
        // Reset node state
        if (lastTraceGroup.current) {
          lastTraceGroup.current = null;
          setShowTrace(false);
        }
      }
    };
    
    // Listen for trace updates and reset events
    document.addEventListener('agentTraceUpdated', handleTraceUpdate);
    document.addEventListener('flowAnimationsStateChanged', handleAnimationFreezeChange);
    document.addEventListener('flowAnimationsReset', handleFlowReset);
    
    // Check local storage for any existing trace data on mount
    const existingTrace = getAgentTrace(id);
    if (existingTrace && (!data.traceGroup || data.traceGroup.id !== existingTrace.id)) {
      lastTraceGroup.current = existingTrace;
      
      // Dispatch an event to update the node data in the parent component
      const nodeUpdateEvent = new CustomEvent('agentNodeUpdate', {
        detail: {
          nodeId: id,
          traceGroup: existingTrace
        }
      });
      document.dispatchEvent(nodeUpdateEvent);
    }
    
    return () => {
      document.removeEventListener('agentTraceUpdated', handleTraceUpdate);
      document.removeEventListener('flowAnimationsStateChanged', handleAnimationFreezeChange);
      document.removeEventListener('flowAnimationsReset', handleFlowReset);
    };
  }, [id, data.traceGroup]);
  
  // Calculate animation class based on state and animation freeze setting
  const getAnimationClass = () => {
    if (areFlowAnimationsFrozen()) {
      // When animations are frozen, use static classes
      return isProcessing ? 'node-frozen-processing' : 
             processingComplete ? 'node-complete' : '';
    } else {
      // Normal animation classes when not frozen
      return isProcessing ? 'node-processing' : 
             processingComplete ? 'node-complete' : '';
    }
  };
  
  const animationClass = getAnimationClass();
  
  // Handle node click to show trace modal
  const handleNodeClick = () => {
    // The parent component (AgentFlowPanel) will handle showing the modal
    const nodeClickEvent = new CustomEvent('agentNodeClicked', {
      detail: {
        nodeId: id,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(nodeClickEvent);
  };
  
  return (
    <div
      ref={nodeRef}
      id={id} // Add id for direct DOM access
      className={`custom-agent-node ${selected ? 'selected' : ''} ${animationClass}`}
      style={{
        border: `3px solid ${nodeColor}`, // Using 3px border as we updated in CSS
        boxShadow: selected ? `0 0 0 3px ${nodeColor}` : 'none',
        ...data.style
      }}
    >
      {/* Add top handle for connections from above */}
      <Handle 
        id="top"
        type="target" 
        position={Position.Top} 
        style={{ borderColor: nodeColor }} 
      />
      
      {/* Left handle for side connections */}
      <Handle 
        id="left"
        type="target" 
        position={Position.Left} 
        style={{ borderColor: nodeColor }} 
      />
      
      <div 
        className="custom-agent-header" 
        style={{ backgroundColor: nodeColor }}
        onClick={handleNodeClick}
      >
        <div className="agent-title">{formattedLabel}</div>
        {(isProcessing || processingComplete) && (
          <div className="agent-status">
            {isProcessing ? '●' : processingComplete ? '✓' : ''}
          </div>
        )}
      </div>
      
      {/* Right handle for side connections */}
      <Handle 
        id="right"
        type="source" 
        position={Position.Right} 
        style={{ borderColor: nodeColor }} 
      />

      {/* Bottom handle for connections from below */}
      <Handle 
        id="bottom"
        type="source" 
        position={Position.Bottom} 
        style={{ borderColor: nodeColor }} 
      />
    </div>
  );
});

export default CustomAgentNode;

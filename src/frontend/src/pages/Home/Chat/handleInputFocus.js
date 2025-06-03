// This file contains the updated handleInputFocus function with animation reset capabilities
// Import this in src/frontend/src/pages/Home/Chat/index.tsx or copy the function body

// Import just resetFlowAnimations to avoid the TypeScript error
import { resetFlowAnimations } from '../../../common/components/react_flow/FlowReset';
import { resetProcessingState, setFlowAnimationsFrozen } from '../../../utilities/killSwitch';
import { clearAllAgentTraces } from '../../../utilities/agentTraceStorage';

/**
 * Reset edge animations independently
 * This is a local implementation to avoid import issues
 */
function resetEdgeAnimationsLocal() {
  console.log('🔄 Manually resetting edge animations only');
  
  // Reset all active edge paths
  const activeEdges = document.querySelectorAll('.react-flow__edge-path.active');
  
  activeEdges.forEach((edge) => {
    edge.classList.remove('active');
  });
  
  // Also find any edge container elements that might have custom classes
  const edgeElements = document.querySelectorAll('.react-flow__edge');
  
  edgeElements.forEach((edge) => {
    // Remove any animation-related classes
    edge.classList.remove('animated-edge');
    edge.classList.remove('active-edge');
    edge.classList.remove('highlighted-edge');
    edge.removeAttribute('data-animated');
    edge.removeAttribute('data-active');
  });
  
  // Dispatch a custom event just for edge resets
  const resetEvent = new CustomEvent('flowEdgesReset', {
    detail: { 
      timestamp: Date.now(),
    }
  });
  document.dispatchEvent(resetEvent);
  
  console.log('✅ Edge animations reset complete');
}

export const handleInputFocus = function() {
    // Stop all text streaming animations immediately
    this.stopAllTextAnimations();
    
    // Reset the React workflow diagram and clear any agent trace data
    // First ensure all animations are reset
    resetFlowAnimations();
    
    // Also specifically target edge animations for extra thoroughness
    // This provides a second layer of cleanup for connection lines
    resetEdgeAnimationsLocal(); // Use local implementation to avoid TS errors
    
    // Reset the processing state so the input field can be enabled
    resetProcessingState();
    
    console.log("Reset animations and processing state");
};

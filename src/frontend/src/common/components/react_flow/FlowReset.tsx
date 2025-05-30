/**
 * FlowReset - Utility for resetting react-flow animations and states
 * 
 * This component provides functions to reset animation states on agent nodes
 * and connections in the react-flow diagram, typically used when starting
 * a new conversation or when animations need to be cleared.
 */

import { setFlowAnimationsFrozen } from '../../../utilities/killSwitch';

/**
 * Reset all flow animations across all nodes and edges
 * This function:
 * - Removes animation classes from all agent nodes
 * - Clears all active edge animations
 * - Dispatches an event to notify components
 */
export function resetFlowAnimations(): void {
  console.log('🔄 Resetting all flow animations');
  
  // 1. Find all nodes with animation classes and reset them
  const animatedNodes = document.querySelectorAll(
    '.node-processing, .node-frozen-processing, .node-complete'
  );
  
  animatedNodes.forEach((node) => {
    // Remove all animation-related classes
    node.classList.remove('node-processing');
    node.classList.remove('node-frozen-processing');
    node.classList.remove('node-complete');
    
    // Log which nodes are being reset
    console.log(`Removed animation classes from node ${node.id || 'unknown'}`);
  });

  // 2. Reset all active edge paths
  const activeEdges = document.querySelectorAll('.react-flow__edge-path.active');
  
  activeEdges.forEach((edge) => {
    edge.classList.remove('active');
    console.log(`Removed active class from edge path`);
  });
  
  // Also find any edge container elements that might have custom classes
  const edgeElements = document.querySelectorAll('.react-flow__edge');
  
  edgeElements.forEach((edge) => {
    // Remove any animation-related classes
    edge.classList.remove('animated-edge');
    edge.classList.remove('active-edge');
    edge.classList.remove('highlighted-edge');
    // Custom data attributes might be used for animation state
    edge.removeAttribute('data-animated');
    edge.removeAttribute('data-active');
  });
  
  // 3. Make sure animation freeze is disabled
  setFlowAnimationsFrozen(false);
  
  // 4. Dispatch a custom event to notify any components listening for animation resets
  const resetEvent = new CustomEvent('flowAnimationsReset', {
    detail: { 
      timestamp: Date.now(),
    }
  });
  document.dispatchEvent(resetEvent);
  
  console.log('✅ Flow animations reset complete');
}

/**
 * Reset only edge animations while preserving node states
 * This is useful when you want to keep node states but clear connection animations
 */
export function resetEdgeAnimations(): void {
  console.log('🔄 Resetting edge animations only');
  
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

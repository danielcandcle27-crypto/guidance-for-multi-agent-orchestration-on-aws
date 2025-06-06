// AgentFlowPanel.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  ReactFlowInstance,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';

// Add type declaration for global trace data storage
declare global {
  interface Window {
    __traceData?: Record<string, Array<{
      timestamp: string;
      edgeId: string;
      traceData: any;
    }>>;
    __processingComplete?: boolean;
    __killAllProcessing?: () => void;
    __activeTimers?: any[];
    __activeIntervals?: any[];
    __hasSetupGlobalDeadSwitch?: boolean;
    __nodeUpdateCounter?: number;
  }
}
// Only import what we need from Cloudscape components
import './FlowComponents.css';
import {
  registerMessageHandler,
  unregisterMessageHandler,
  generateConnectionId,
  connectWebSocket,
  isWebSocketConnected,
  parseTraceData
} from '../../../utilities/multiWebsocket';
import { setupGlobalKillSwitch, safeSetTimeout, isProcessingComplete } from '../../../utilities/killSwitch';
import { 
  isFinalMessage, 
  dispatchFinalMessageDetected,
  dispatchFinalMessageRendered,
  FinalMessageKillSwitchListener 
} from '../../../utilities/finalMessageKillSwitch';
import { storeAgentTrace, getAgentTrace, collaboratorToNodeId, validateTraceOwnership } from '../../../utilities/agentTraceStorage';
import CustomAgentNode from './CustomAgentNode';
import CustomEdge from './CustomEdge'; // Import for custom edge component
import { createInitialNodes, createInitialEdges } from './AgentFlowNodeConfig';
import { TraceGroup } from '../../../utilities/traceParser';
import TraceModal from './TraceModal';
import { getAgentColor } from './FlowUtils';

interface AgentFlowPanelProps {
  height?: string;
  sessionId: string;
  modelId?: string;
}

// Define node details for showing more information when clicked
interface NodeDetails {
  title: string;
  description: string;
  details: string;
}

// Interface to track trace history
interface TraceHistoryItem {
  timestamp: string;
  collaboratorName: string;
  inputTokens?: number;
  outputTokens?: number;
  toolCalls?: string[];
  prompt?: string;
  response?: string;
  queryType?: string;
}

// Interface to track edge statistics
interface EdgeStats {
  callCount: number;
  avgDuration?: number; // Average processing duration in ms
  history: TraceHistoryItem[];
}

const nodeDetailsMap: Record<string, NodeDetails> = {
  'routing-classifier': {
    title: 'Routing Classifier',
    description: 'Initial classifier that analyzes customer queries to determine intent.',
    details: 'The routing classifier is the first point of contact for customer queries. It uses natural language processing to understand customer intent, categorize the query type, and route it to the appropriate agent. This ensures that each customer query is handled by the most relevant specialist.'
  },
  'supervisor-agent': {
    title: 'Customer Service Agent (Supervisor)',
    description: 'The main supervisor agent that coordinates specialized customer support sub-agents.',
    details: 'This agent analyzes customer queries, determines which specialized sub-agents to consult, and synthesizes their responses into a cohesive answer. It routes customer inquiries to the appropriate specialized expertise areas.'
  },
  'order-mgmt-agent': {
    title: 'Order Management Agent',
    description: 'Expert in handling order-related inquiries and inventory management.',
    details: 'This agent accesses order history, tracks current orders, provides shipping updates, processes returns and exchanges, and handles inventory-related questions to ensure customers receive accurate order information.'
  },
  'ts-agent': {
    title: 'Troubleshooting Agent',
    description: 'Expert in technical support and problem resolution for products and services.',
    details: 'This agent provides step-by-step troubleshooting guidance, diagnoses common product issues, offers solutions for known problems, and escalates complex technical issues when necessary.'
  },
  'personalization-agent': {
    title: 'Personalization Agent',
    description: 'Expert in understanding customer preferences and personalizing experiences.',
    details: 'This agent analyzes customer browsing history, purchase patterns, and stated preferences to provide tailored recommendations and personalized support experiences based on individual customer profiles.'
  },
  'product-rec-agent': {
    title: 'Product Recommendation Agent',
    description: 'Expert in suggesting relevant products based on customer needs.',
    details: 'This agent recommends products based on customer purchase history, browsing behavior, product compatibility, and stated preferences. It leverages product catalog data and customer feedback to make informed suggestions.'
  },
  'action-group': {
    title: 'Action Group',
    description: 'Handles specific customer support actions and system integrations.',
    details: 'This agent executes specific actions requested by customers or other agents, such as processing refunds, updating account information, or accessing external systems to fulfill customer requests.'
  },
  'customer': {
    title: 'Customer',
    description: 'The end user who submits support questions or requests.',
    details: 'The customer interacts with the Customer Service Agent by asking questions about orders, products, technical issues, or other support-related topics.'
  },
  'response': {
    title: 'Response to Customer',
    description: 'The final answer delivered to the customer.',
    details: 'After consulting with specialized sub-agents, the supervisor agent synthesizes their insights into a comprehensive, cohesive response that addresses the customer\'s inquiry with helpful information and next steps.'
  }
};

// Create a styled component for the flow container
const FlowContainer = ({ children, height }: { children: React.ReactNode, height: string }) => (
  <div style={{ 
    width: '100%', 
    height: height,
    border: '1px solid #eee',
    borderRadius: '5px',
    overflow: 'hidden',
    maxHeight: '100%'
  }}>
    {children}
  </div>
);

// Define node types and edge types
const nodeTypes = {
  customAgent: CustomAgentNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

// We're exporting as a named export (not default export)
export const AgentFlowPanel: React.FC<AgentFlowPanelProps> = ({ height = '100%', sessionId, modelId = 'us.amazon.nova-micro-v1:0' }) => {
  // Initialize nodes with default configuration
  const [nodes, setNodes] = useNodesState(createInitialNodes());
  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  
  // Initialize edges with the custom edge type and default data
  const [edges, setEdges] = useEdgesState(
    createInitialEdges().map(edge => ({
      ...edge,
      type: 'customEdge',
      data: { 
        callCount: 0,
        isActive: false,
        agentName: getEdgeAgentName(edge.id)
      }
    }))
  );
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
  
  // Utility function to get agent name for edge
  function getEdgeAgentName(edgeId: string): string {
    if (edgeId === 'e-supervisor-sa1') return 'Order Management';
    if (edgeId === 'e-supervisor-sa2') return 'Product Recommendation';
    if (edgeId === 'e-supervisor-sa3') return 'Personalization';
    if (edgeId === 'e-supervisor-sa4') return 'Troubleshooting';
    if (edgeId.includes('routing-classifier')) return 'Routing Classifier';
    if (edgeId.includes('customer')) return 'Customer';
    return 'Agent';
  }

  // Utility function to get edge ID for a collaborator name
  function getEdgeIdForCollaborator(collaboratorName: string): string {
    // Standardize collaborator name
    const normalizedName = collaboratorName.toLowerCase();

    // Map collaborator names to edge IDs
    if (normalizedName.includes('order') || normalizedName === 'ordermanagement') {
      return 'e-supervisor-sa1';
    } else if (normalizedName.includes('product') || normalizedName === 'productrecommendation') {
      return 'e-supervisor-sa2';
    } else if (normalizedName.includes('personal') || normalizedName === 'personalization') {
      return 'e-supervisor-sa3';
    } else if (normalizedName.includes('trouble') || normalizedName === 'troubleshoot') {
      return 'e-supervisor-sa4';
    } else if (normalizedName.includes('rout') || normalizedName.includes('class')) {
      return 'e-routing-classifier-supervisor';
    } else if (normalizedName.includes('super')) {
      return 'e-customer-supervisor';
    }

    // For any other collaborator, create a standardized edge ID format
    return `e-supervisor-${normalizedName.replace(/[^a-z0-9]/g, '')}`;
  }
  
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeCollaborators, setActiveCollaborators] = useState<Set<string>>(new Set());
  const [edgeStats, setEdgeStats] = useState<Record<string, EdgeStats>>({});
  const [edgeTraceGroups, setEdgeTraceGroups] = useState<Record<string, TraceGroup>>({});
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isEdgeModalVisible, setIsEdgeModalVisible] = useState(false);
  const [connectionId, setConnectionId] = useState<string>('');
  const [traceModalState, setTraceModalState] = useState({
    isVisible: false,
    nodeId: '',
    nodeName: '',
    traceGroup: null as TraceGroup | null,
    nodeDescription: ''
  });
 

  // Add ref for React Flow instance
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  
  // Function to find connected edges for a node
  const findConnectedEdges = (nodeId: string) => {
    return edges.filter(edge => 
      // Source connection (outgoing)
      (edge.source === nodeId) || 
      // Target connection (incoming)
      (edge.target === nodeId) ||
      // Special case for supervisor agent connections
      (nodeId === 'supervisor-agent' && edge.id.includes('supervisor')) ||
      // Special case for subagent connections
      ((nodeId === 'order-mgmt-agent' && edge.id === 'e-supervisor-sa1') ||
       (nodeId === 'product-rec-agent' && edge.id === 'e-supervisor-sa2') ||
       (nodeId === 'personalization-agent' && edge.id === 'e-supervisor-sa3') ||
       (nodeId === 'ts-agent' && edge.id === 'e-supervisor-sa4'))
    );
  };
  
  // Enhanced function to activate agent node and connected edges
  const activateAgent = useCallback((nodeId: string, traceGroup: TraceGroup, options?: { noAnimation?: boolean }) => {
   // console.log(`Activating agent ${nodeId} with trace data`, { nodeId, traceGroupId: traceGroup?.id });
   
   // Check if we should skip animations - always skip for supervisor-agent
   const skipAnimation = options?.noAnimation === true || nodeId === 'supervisor-agent';
    
    // Force React Flow to update the node appearance with isProcessing flag
    // Note: Directly manipulating the node's data object is key to state updates
    setNodes(nodes => {
      // Find node in current node list
      const existingNode = nodes.find(n => n.id === nodeId);
      // if (existingNode) {
      //   console.log(`Found node ${nodeId} to update, current processing state:`, 
      //               existingNode.data?.isProcessing);
      // } else {
      //   console.warn(`Node ${nodeId} not found in nodes array!`);
      // }
      
      return nodes.map(n => {
        if (n.id === nodeId) {
        //  console.log(`Updating node ${nodeId} to processing state`);
          
          // Create a completely new data object to ensure React detects the change
          const newData = {
            ...n.data,
            isProcessing: true,
            processingAnimationKey: Date.now(), // Force re-render with unique key
            showTraceContent: true, // Show trace content by default
            traceGroup: { ...traceGroup } // Clone to ensure reference changes
          };  
          return {
            ...n,
            data: newData,
            className: 'node-processing' // Add class at the node level too
          };
        }
        return n;
      });
    });
    
    // Store trace data for this node
    storeAgentTrace(nodeId, traceGroup);
    
    // Find all connected edges for this node
    const connectedEdges = findConnectedEdges(nodeId);
    
    // Activate connected edges with glowing animation
    // Skip animation for supervisor-agent node connections and
    // Skip animating the customer-supervisor connection when browser node is active
    if (connectedEdges.length > 0 && !skipAnimation) {
      setEdges(edges => 
        edges.map(e => {
          // Skip animating the top connection to supervisor when browser node is active
          if (nodeId === 'customer' && e.id === 'e-customer-supervisor') {
            return e; // Don't animate this edge when browser node is active
          }
          
          if (connectedEdges.some(ce => ce.id === e.id)) {
            return {
              ...e,
              data: {
                ...e.data,
                isActive: true,
                callCount: (e.data?.callCount || 0) + 1
              },
              animated: true, // Add animation at the edge level
              style: { 
                ...e.style,
                stroke: '#2196F3', 
                strokeWidth: 3
              }
            };
          }
          return e;
        })
      );
      
      // Also apply the active class directly to the edge paths for immediate visual feedback
      setTimeout(() => {
        connectedEdges.forEach(edge => {
          const edgeElement = document.getElementById(edge.id);
          if (edgeElement) {
            edgeElement.classList.add('active');
          }
        });
      }, 10);
    }
    
    // Also check for any related nodes that should be activated
    if (nodeId === 'supervisor-agent' && !skipAnimation) {
      // When supervisor is active, also activate connected agent edges (only if animation is allowed)
      const subAgentEdges = edges.filter(e => 
        e.id.startsWith('e-supervisor-sa')
      );
      
      if (subAgentEdges.length > 0) {
        setEdges(edges =>
          edges.map(e => {
            if (subAgentEdges.some(se => se.id === e.id)) {
              return {
                ...e,
                data: {
                  ...e.data,
                  isActive: true
                },
                animated: true
              };
            }
            return e;
          })
        );
        
        // Apply active class directly to sub-agent edges
        setTimeout(() => {
          subAgentEdges.forEach(edge => {
            const edgeElement = document.getElementById(edge.id);
            if (edgeElement) {
              edgeElement.classList.add('active');
            }
          });
        }, 10);
        
        // Also activate the sub-agent nodes connected to these edges
        subAgentEdges.forEach(edge => {
          // Extract target node ID from edge ID patterns
          let targetNodeId = '';
          if (edge.id === 'e-supervisor-sa1') targetNodeId = 'order-mgmt-agent';
          else if (edge.id === 'e-supervisor-sa2') targetNodeId = 'product-rec-agent';
          else if (edge.id === 'e-supervisor-sa3') targetNodeId = 'personalization-agent';
          else if (edge.id === 'e-supervisor-sa4') targetNodeId = 'ts-agent';
          
          if (targetNodeId) {
            // Create a simplified trace group for the sub-agent
            const subAgentTraceGroup: TraceGroup = {
              id: `trace-from-${nodeId}-${Date.now()}`,
              type: 'trace-group',
              sender: 'bot',
              dropdownTitle: `Sub-agent activity from ${nodeId}`,
              agentId: targetNodeId,
              originalAgentType: targetNodeId.replace('-agent', ''),
              tasks: [{
                title: 'Sub-agent processing',
                stepNumber: 1,
                content: `Processing request from ${nodeId}`,
                timestamp: Date.now()
              }],
              text: 'Sub-agent trace',
              startTime: Date.now(),
              lastUpdateTime: Date.now()
            };
            
            // Update just this sub-agent node
            setNodes(nodes => nodes.map(n => {
              if (n.id === targetNodeId) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    isProcessing: true,
                    processingAnimationKey: Date.now()
                  },
                  className: 'node-processing'
                };
              }
              return n;
            }));
          }
        });
      }
    }
    
    // Also mark this agent as an active collaborator
    setActiveCollaborators(prev => new Set(prev).add(nodeId));
    
    // We'll also dispatch a custom event that will be caught by our global listener
    // This is a fallback mechanism for direct DOM manipulation
    const processingEvent = new CustomEvent('agentProcessingUpdate', {
      detail: {
        nodeId: nodeId,
        isProcessing: true,
        processingComplete: false,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(processingEvent);
    
    // Try direct DOM manipulation as last resort
    setTimeout(() => {
      try {
        // ReactFlow uses data-id attributes for its nodes
        const nodeElements = document.querySelectorAll(`[data-id="${nodeId}"]`);
        if (nodeElements.length > 0) {
          nodeElements.forEach(el => {
            (el as HTMLElement).classList.add('node-processing');
          });
        } else {
          // Try by node ID as well
          const nodeElement = document.getElementById(nodeId);
          if (nodeElement) {
            nodeElement.classList.add('node-processing');
          }
          
          // Try every possible selector for the node
          const allNodes = document.querySelectorAll('.react-flow__node');
          allNodes.forEach(node => {
            if ((node as HTMLElement).id === nodeId ||
                (node as HTMLElement).getAttribute('data-id') === nodeId) {
              (node as HTMLElement).classList.add('node-processing');
            }
          });
        }
      } catch (e) {
        console.error('Error in direct DOM manipulation:', e);
      }
    }, 50);
    
    // Auto-fit the view to ensure all active nodes are visible
    setTimeout(() => {
      if (reactFlowInstanceRef.current) {
        reactFlowInstanceRef.current.fitView({padding: 0.1, includeHiddenNodes: false});
      }
    }, 100);
    
  }, [edges, findConnectedEdges, setEdges, setNodes]);

  // Track completion state to prevent processing after completion
  const [isResponseComplete, setIsResponseComplete] = useState<boolean>(false);

  // Define handler for websocket trace messages outside useEffect so it can be referenced elsewhere
    const handleWebSocketTraceMessage = useCallback((data: any) => {
      // Skip processing if the response is already complete
      if (isResponseComplete && !data?.forceUpdate) {
        // Skip logging to reduce console noise
        return;
      }

      // Check for response completion flag
      if (data?.onUpdateChat?.responseComplete || data?.content?.responseComplete || data?.responseComplete) {
        // Mark the response as complete without excessive logging
        setIsResponseComplete(true);
      }
      
      // Extract collaborator name or agent type from trace data
      let collaboratorName = '';
      let agentName = '';
      
      // Variables to track if we have user input or system response content
      let userInputContent = null;
      let systemResponseContent = null;
      let hasModelInput = false;
      let hasFinalResponse = false;
      
      if (data.content && data.content.trace) {
        // Get trace data from content
        const traceContent = data.content;
        
        try {
          // Check for routing classifier trace structure first (highest priority)
          if (traceContent.trace?.routingClassifierTrace) {
            console.log('%c[Flow Panel] Found routing classifier trace structure', 'color: #4CAF50; font-weight: bold;');
            collaboratorName = 'ROUTING_CLASSIFIER';
            agentName = 'ROUTING_CLASSIFIER';
          } 
          // Then check if it's explicitly labeled as supervisor
          else if (traceContent.trace?.orchestrationTrace?.rationale || 
                   traceContent.trace?.orchestrationTrace?.observation?.finalResponse) {
            console.log('%c[Flow Panel] Found supervisor trace via rationale/finalResponse', 'color: #9C27B0; font-weight: bold;');
            collaboratorName = 'SupervisorAgent';
            agentName = 'SupervisorAgent';
            
            // Check for final response content
            if (traceContent.trace?.orchestrationTrace?.observation?.finalResponse?.text) {
              systemResponseContent = traceContent.trace?.orchestrationTrace?.observation?.finalResponse?.text;
              hasFinalResponse = true;
            }
          }
          // Then try extraction from regular fields
          else {
            // Extract names from various possible locations
            collaboratorName = traceContent.collaboratorName || 
                              traceContent.trace?.collaboratorName ||
                              '';
                              
            agentName = traceContent.agentName || 
                       traceContent.trace?.agentName ||
                       '';
            
            if ((!collaboratorName && !agentName) && traceContent.trace) {
              // Check in orchestration trace
              if (traceContent.trace.orchestrationTrace?.invocationInput?.agentCollaboratorInvocationInput?.agentCollaboratorName) {
                collaboratorName = traceContent.trace.orchestrationTrace.invocationInput.agentCollaboratorInvocationInput.agentCollaboratorName;
              }
            }
          }
          
          // Extract user input content from model input (Step 1)
          if (traceContent.trace?.orchestrationTrace?.modelInvocationInput?.text) {
            userInputContent = traceContent.trace.orchestrationTrace.modelInvocationInput.text;
            hasModelInput = true;
          }

        } catch (e) {
          console.error('Error extracting collaborator from trace:', e);
        }
      } else if (data.collaboratorName || data.agentName) {
        // Direct collaborator or agent name
        collaboratorName = data.collaboratorName || '';
        agentName = data.agentName || '';
      } else if (data.onUpdateChat?.trace) {
        // Try to extract from onUpdateChat message format
        try {
          const traceData = typeof data.onUpdateChat.trace === 'string' 
            ? JSON.parse(data.onUpdateChat.trace) 
            : data.onUpdateChat.trace;
          
          collaboratorName = traceData.collaboratorName || '';
          agentName = traceData.agentName || '';
          
          // Check for routing classifier structure
          if (traceData.trace?.routingClassifierTrace) {
            collaboratorName = 'ROUTING_CLASSIFIER';
            agentName = 'ROUTING_CLASSIFIER';
          }
          
          // Extract user input content from model input if available
          if (traceData.trace?.orchestrationTrace?.modelInvocationInput?.text) {
            userInputContent = traceData.trace.orchestrationTrace.modelInvocationInput.text;
            hasModelInput = true;
          }
          
          // Extract system response content from final response if available
          if (traceData.trace?.orchestrationTrace?.observation?.finalResponse?.text) {
            systemResponseContent = traceData.trace.orchestrationTrace.observation.finalResponse.text;
            hasFinalResponse = true;
          }
        } catch (e) {
          console.error('Error parsing onUpdateChat trace:', e);
        }
      }
      
      // Use either collaboratorName or agentName to identify the node
      const identifier = collaboratorName || agentName;
      
      // If we have an identifier, map it to a node ID and activate it
      if (identifier) {
        // Map identifier to node ID
        const nodeId = mapCollaboratorToNodeId(identifier);
        
        console.log(`%c[Flow Panel] Mapping identifier "${identifier}" to node ID: ${nodeId}`, 
                   nodeId === 'routing-classifier' ? 'color: #4CAF50; font-weight: bold;' : 
                   nodeId === 'supervisor-agent' ? 'color: #9C27B0; font-weight: bold;' : 
                   'color: #2196F3;');
        
        // Get any existing trace for this node
        const existingTrace = getAgentTrace(nodeId);
        
        if (existingTrace) {
          activateAgent(nodeId, existingTrace);
        } else {
          // Create a simple trace group to activate the node
          const simpleTraceGroup: TraceGroup = {
            id: `temp-trace-${Date.now()}`,
            type: 'trace-group' as const,
            sender: 'bot',
            dropdownTitle: `${identifier} Trace`,
            agentId: nodeId,
            originalAgentType: identifier,
            tasks: [{
              title: identifier,
              content: "Processing...",
              stepNumber: 1,
              timestamp: Date.now()
            }],
            text: "Agent trace information",
            startTime: Date.now(),
            lastUpdateTime: Date.now(),
            isComplete: false
          };
          
          // Check if this is the supervisor node to avoid animating its edges
          const skipAnimation = nodeId === 'supervisor-agent';
          
          // Activate the agent with this trace group
          activateAgent(nodeId, simpleTraceGroup, { noAnimation: skipAnimation });
        }
        
        // BROWSER NODE HANDLING:
        // Always update the browser node with messages, processed separately
        // Handle this regardless of whether an agent was identified
        {
          // BROWSER NODE HANDLING: Process both user input and system response
          const browserNodeId = 'customer';

          // Handle user input detection first
          if (hasModelInput && userInputContent) {
            console.log('%c[Browser Node] Capturing user input message', 'color: #FF5722; font-weight: bold;');
            
            // Get any existing browser trace
            const existingBrowserTrace = getAgentTrace(browserNodeId);
            
            // Create a new trace or update existing one
            const browserTraceId = `browser-trace-${Date.now()}`;
            const startTime = existingBrowserTrace?.startTime || Date.now();
            
            // Make a copy of existing tasks to avoid reference issues
            const tasks = [...(existingBrowserTrace?.tasks || [])];
            
            // Add user input task with type assertion to avoid TypeScript errors
            tasks.push({
              stepNumber: 1,
              title: `User Input (${((Date.now() - startTime) / 1000).toFixed(2)}s)`,
              content: userInputContent,
              timestamp: Date.now(),
              _groupId: `user-input-${Date.now()}`,
              // Use type assertion to add custom property
              _direction: 'outgoing' // Mark as outgoing message
            } as any); // Type assertion to avoid TypeScript errors
            
            // Create or update the browser trace group
            const browserTraceGroup: TraceGroup = {
              id: existingBrowserTrace?.id || browserTraceId,
              type: 'trace-group',
              sender: 'bot',
              dropdownTitle: 'Browser Messages',
              agentId: browserNodeId,
              originalAgentType: 'Browser',
              tasks: tasks,
              text: "Browser communication",
              startTime: startTime,
              lastUpdateTime: Date.now(),
              isComplete: false // Not complete until we get final response
            };
            
            // Store and activate the browser node - but with special flag for browser-to-supervisor connections
            console.log('%c[Browser Node] Storing user input in browser trace:', 'color: #FF5722; font-weight: bold;', 
                      { taskCount: tasks.length, userInput: userInputContent.substring(0, 50) + '...' });
            storeAgentTrace(browserNodeId, browserTraceGroup);
            
            // Use special option to prevent animating the connection to supervisor when ONLY browser node is active
            // This will keep the browser node active but not animate the connection to supervisor
            activateAgent(browserNodeId, browserTraceGroup, { noAnimation: true });
          }
          
          // Handle system response separately
          if (hasFinalResponse && systemResponseContent) {
            console.log('%c[Browser Node] Capturing system response', 'color: #FF5722; font-weight: bold;');
            
            // Get any existing browser trace again (it may have been updated with user input)
            const existingBrowserTrace = getAgentTrace(browserNodeId);
            
            if (!existingBrowserTrace) {
              // If no existing trace exists, create a new one for the response
              console.log("Creating new browser trace for system response");
              
              const browserTraceId = `browser-trace-${Date.now()}`;
              const startTime = Date.now() - 5000; // Backdate a bit to allow for reasonable timing
              
              // Create a trace group with just the response
              const browserTraceGroup: TraceGroup = {
                id: browserTraceId,
                type: 'trace-group',
                sender: 'bot',
                dropdownTitle: 'Browser Messages',
                agentId: browserNodeId,
                originalAgentType: 'Browser',
                tasks: [{
                  stepNumber: 2,
                  title: `System Response (${((Date.now() - startTime) / 1000).toFixed(2)}s)`,
                  content: systemResponseContent,
                  timestamp: Date.now(),
                  _groupId: `system-response-${Date.now()}`,
                  _direction: 'incoming' // Mark as incoming message
                } as any], // Type assertion to avoid TypeScript errors
                text: "Browser communication",
                startTime: startTime,
                lastUpdateTime: Date.now(),
                isComplete: true,
                finalElapsedTime: ((Date.now() - startTime) / 1000).toFixed(2)
              };
              
              // Store and activate the browser node - with special flag to prevent animating the connection to supervisor
              storeAgentTrace(browserNodeId, browserTraceGroup);
              activateAgent(browserNodeId, browserTraceGroup, { noAnimation: true });
              return;
            }
            
            // Make a copy of existing tasks to avoid reference issues
            const tasks = [...(existingBrowserTrace.tasks || [])];
            
            // Add system response task
            tasks.push({
              stepNumber: 2,
              title: `System Response (${((Date.now() - existingBrowserTrace.startTime) / 1000).toFixed(2)}s)`,
              content: systemResponseContent,
              timestamp: Date.now(),
              _groupId: `system-response-${Date.now()}`,
              _direction: 'incoming' // Mark as incoming message
            } as any); // Type assertion to avoid TypeScript errors
            
            // Update the browser trace group
            const browserTraceGroup: TraceGroup = {
              ...existingBrowserTrace,
              tasks: tasks,
              text: "Browser communication",
              lastUpdateTime: Date.now(),
              isComplete: true // Mark as complete with final response
            };
            
            // Calculate elapsed time
            browserTraceGroup.finalElapsedTime = ((Date.now() - browserTraceGroup.startTime) / 1000).toFixed(2);
            
            // Store and activate the browser node
            console.log('%c[Browser Node] Storing system response in browser trace:', 'color: #FF5722; font-weight: bold;', 
                      { taskCount: tasks.length, firstTask: tasks[0]?.title, lastTask: tasks[tasks.length-1]?.title });
            storeAgentTrace(browserNodeId, browserTraceGroup);
            activateAgent(browserNodeId, browserTraceGroup);
          }
        }
      }
    }, [activateAgent, isResponseComplete]);
    
  // Helper function to map collaborator or agent name to node ID
  const mapCollaboratorToNodeId = (identifier: string): string => {
    // Define color coding for each agent type
    const agentColors = {
      'supervisor-agent': 'color: #9C27B0; font-weight: bold;', // Purple
      'routing-classifier': 'color: #4CAF50; font-weight: bold;', // Green
      'product-rec-agent': 'color: blue; font-weight: bold;', // Blue
      'ts-agent': 'color: #FF9800; font-weight: bold;', // Orange
      'personalization-agent': 'color: #E91E63; font-weight: bold;', // Pink
      'order-mgmt-agent': 'color: brown; font-weight: bold;', // Brown
      'customer': 'color: #607D8B; font-weight: bold;', // Grey
      'default': 'color: #607D8B; font-style: italic;' // Grey italic for unknown
    };
    
    let nodeId = '';
    
    // EXACT MATCHES - Highest priority
    // Check for routing classifier exact matches first (highest priority)
    if (identifier === "ROUTING_CLASSIFIER" || 
        identifier === "routing_classifier" ||
        identifier === "RoutingClassifier" ||
        identifier === "Routing_Classifier") {
      console.log('%c[Routing Classifier] Found exact match for routing classifier', agentColors['routing-classifier']);
      nodeId = 'routing-classifier';
    } 
    // Check for supervisor exact matches next (also highest priority)
    else if (identifier === "SupervisorAgent" ||
             identifier === "SUPERVISOR" || 
             identifier === "Supervisor") {
      console.log('%c[Supervisor Agent] Found exact match for supervisor', agentColors['supervisor-agent']);
      nodeId = 'supervisor-agent';
    }
    // Check for Unknown agent name - treat as Supervisor
    else if (identifier === "Unknown") {
      console.log('%c[Unknown Agent] Found Unknown agent name - treating as supervisor', agentColors['supervisor-agent']);
      nodeId = 'supervisor-agent';
    }
    else {
      // Standardize identifier name for pattern matching
      const normalizedName = identifier.toLowerCase();
      
      // Map names to node IDs
      if (normalizedName.includes('order') || normalizedName === 'ordermanagement') {
        nodeId = 'order-mgmt-agent';
      } else if (normalizedName.includes('product') || normalizedName === 'productrecommendation') {
        nodeId = 'product-rec-agent';
      } else if (normalizedName.includes('personal') || normalizedName === 'personalization') {
        nodeId = 'personalization-agent';
      } else if (normalizedName.includes('trouble') || normalizedName === 'troubleshoot') {
        nodeId = 'ts-agent';
      } else if (normalizedName.includes('routing') || 
                 normalizedName.includes('classifier') || 
                 normalizedName.includes('class')) {
        nodeId = 'routing-classifier';
      } else if (normalizedName.includes('super')) {
        nodeId = 'supervisor-agent';
      } else {
        // For any other identifier, return a fallback
        nodeId = 'supervisor-agent'; // Default to supervisor
      }
    }
    
    // Log with appropriate color
    const displayColor = agentColors[nodeId] || agentColors.default;
    console.log(`%c[${identifier}] → Mapped to node: ${nodeId}`, displayColor);
    
    return nodeId;
  };
  
  // Effect for websocket connection and event listeners
  useEffect(() => {
  // Check if processing is already complete - don't set up any connections
  if (window.__processingComplete) {
    console.log("Processing already complete - skipping websocket connection");
    
    // CRITICAL FIX: Immediately clear any cached trace data to prevent reprocessing loops
    try {
      localStorage.removeItem('agent-trace-cache');
    } catch (e) {
      console.error("Error clearing trace cache:", e);
    }
    
    return;
  }
    
    // Generate a stable connection ID for this component instance
    const connId = generateConnectionId(sessionId, modelId);
    setConnectionId(connId);
    
    // Manage WebSocket connection with debounce
    let wsConnection = null;
    let connectionAttempted = false;
    let handlerRegistered = false;
    
    // Avoid creating WebSocket connection on every render
    const setupWebSocket = () => {
      // Skip if already attempted in this effect cycle or processing is complete
      if (connectionAttempted || window.__processingComplete) return;
      connectionAttempted = true;
      
      try {
        // Check if we already have a working connection
        if (isWebSocketConnected()) {
          console.log('Using existing websocket connection');
          return; // Don't attempt a new connection
        }
        
        // Use setTimeout to slightly delay connection attempt to avoid race conditions
        const connTimer = setTimeout(() => {
          // Final check before connecting
          if (window.__processingComplete) {
            console.log("Processing completed before connection attempt - cancelling");
            return;
          }
          
          wsConnection = connectWebSocket(sessionId, modelId, () => {
            console.log('Flow panel websocket connected successfully');
          });
          
          // Set up automatic kill after a delay - if we're still getting websocket events after 10s
          // it likely means we're stuck in a loop
          setTimeout(() => {
            if (window.__killAllProcessing) {
              console.log("⛔ FINAL AUTOMATIC CLEANUP - 10s after websocket connection");
              window.__killAllProcessing();
            }
          }, 10000);
          
        }, 200); // Short delay to prevent connection flood
        
        // Register timer for cleanup
        if (window.__activeTimers) {
          window.__activeTimers.push(connTimer as any);
        }
        
      } catch (err) {
        console.warn('Failed to establish WebSocket connection:', err);
      }
    };
    
    // Only attempt websocket setup if we're not already complete
    if (!window.__processingComplete) {
      // Attempt to set up WebSocket connection
      setupWebSocket();
      
      // Register our websocket trace message handler for all message types
      registerMessageHandler(connId, 'trace', handleWebSocketTraceMessage);
      registerMessageHandler(connId, 'onUpdateChat', handleWebSocketTraceMessage);
      registerMessageHandler(connId, '*', handleWebSocketTraceMessage);
      handlerRegistered = true;
      
      // Listen for websocket messages via window event
      window.addEventListener('message', handleWebSocketTraceMessage);
    }
    
    // Set up an automatic cleanup function after 15 seconds, even if we don't get an explicit unregister
    const finalCleanupTimer = setTimeout(() => {
      if (handlerRegistered) {
        console.log(`🧹 Automatic final cleanup of websocket handlers for ${connId}`);
        try {
          unregisterMessageHandler(connId, 'trace', handleWebSocketTraceMessage);
          unregisterMessageHandler(connId, 'onUpdateChat', handleWebSocketTraceMessage);
          unregisterMessageHandler(connId, '*', handleWebSocketTraceMessage);
        } catch (e) {
          console.log("Error during auto-cleanup:", e);
        }
      }
    }, 15000);
    
    // Track this timer
    if (window.__activeTimers) {
      window.__activeTimers.push(finalCleanupTimer as any);
    }
    
    return () => {
      // Clean up all event listeners
      window.removeEventListener('message', handleWebSocketTraceMessage);
  
      // Also unregister any websocket handlers
      if (handlerRegistered) {
        unregisterMessageHandler(connId, 'trace', handleWebSocketTraceMessage);
        unregisterMessageHandler(connId, 'onUpdateChat', handleWebSocketTraceMessage);
        unregisterMessageHandler(connId, '*', handleWebSocketTraceMessage);
        console.log(`Cleaned up websocket handlers for ${connId}`);
      }
      
      // Clear the final cleanup timer
      clearTimeout(finalCleanupTimer);
    };
  }, [sessionId, modelId, handleWebSocketTraceMessage]); // Only re-run if these values change
  
  // Keep track of updates we initiated to prevent infinite loops
  const selfInitiatedUpdates = useRef<Set<string>>(new Set());
  
  // Define the trace update handler function - improved to prevent infinite loops
  const handleTraceUpdate = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.nodeId && customEvent.detail.traceGroup) {
      const { nodeId, traceGroup, source } = customEvent.detail;
      
      // Create a unique key for this update with additional timestamp
      const updateKey = `${nodeId}-${traceGroup.id}`;
      
      // More aggressive deduplication of updates
      if (selfInitiatedUpdates.current.has(updateKey)) {
        console.log(`Ignoring self-initiated trace update for ${nodeId} to prevent infinite loop`);
        // Don't delete from set here - keep it longer to prevent cycles
        return;
      }
      
      console.log(`Received trace update event for node ${nodeId}`);
      
      // Track this update as one we're initiating with a timestamp
      selfInitiatedUpdates.current.add(updateKey);
      
      // Check if this is the supervisor node and respect noAnimation flag if provided in the event
      const skipAnimation = customEvent.detail.noAnimation === true || nodeId === 'supervisor-agent';
      
      // Use the activateAgent function to handle all activation logic
      activateAgent(nodeId, traceGroup, { noAnimation: skipAnimation });
      
      // Clean up the tracking after a longer delay to better prevent loops
      setTimeout(() => {
        selfInitiatedUpdates.current.delete(updateKey);
      }, 2000); // Increased from 500ms to 2000ms
    }
  }, [activateAgent]);

  // Listen for processing state updates
  const handleProcessingUpdate = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.nodeId) {
      const { nodeId, isProcessing, processingComplete } = customEvent.detail;
      
      //console.log(`Received processing update for node ${nodeId}: processing=${isProcessing}, complete=${processingComplete}`);
      
      // Update the node's processing state
      setNodes(nodes => 
        nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                isProcessing: isProcessing !== undefined ? isProcessing : n.data.isProcessing,
                processingComplete: processingComplete !== undefined ? processingComplete : n.data.processingComplete
              }
            };
          }
          return n;
        })
      );
      
      // Also update connected edges to show them as active/inactive
      const connectedEdges = findConnectedEdges(nodeId);
      if (connectedEdges.length > 0) {
        setEdges(edges => 
          edges.map(e => {
            if (connectedEdges.some(ce => ce.id === e.id)) {
              return {
                ...e,
                data: {
                  ...e.data,
                  isActive: isProcessing && !processingComplete // Only active if processing and not complete
                },
                animated: isProcessing && !processingComplete // Also update animated prop
              };
            }
            return e;
          })
        );
        
        // Also force CSS class updates on the path elements for immediate feedback
        setTimeout(() => {
          connectedEdges.forEach(edge => {
            const pathElement = document.getElementById(edge.id);
            if (pathElement) {
              if (isProcessing && !processingComplete) {
                pathElement.classList.add('active');
                //console.log(`Activated animation for edge ${edge.id}`);
              } else {
                pathElement.classList.remove('active');
               // console.log(`Deactivated animation for edge ${edge.id}`);
              }
            }
          });
        }, 0);
      }
      
      // Direct DOM manipulation for immediate visual feedback on the node
      setTimeout(() => {
        // Get the node element using all possible selectors
        const nodeElements = [
          document.getElementById(nodeId),
          ...Array.from(document.querySelectorAll(`[data-id="${nodeId}"]`))
        ].filter(Boolean) as HTMLElement[];
        
        if (nodeElements.length > 0) {
          nodeElements.forEach(el => {
            if (isProcessing && !processingComplete) {
              el.classList.add('node-processing');
              el.classList.remove('node-complete');
            } else if (processingComplete) {
              el.classList.remove('node-processing');
              el.classList.add('node-complete');
            } else {
              el.classList.remove('node-processing');
              el.classList.remove('node-complete');
            }
          });
        }
      }, 10);
    }
  }, [findConnectedEdges, setEdges, setNodes]);
  
  // Handle node click events from CustomAgentNode
  const handleNodeClicked = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.nodeId) {
      const { nodeId } = customEvent.detail;
      console.log(`Handling click for node ${nodeId}`);
      
      // Get node details from the map
      const nodeDetails = nodeDetailsMap[nodeId] || {
        title: nodeId,
        description: 'Node description not available.',
        details: ''
      };
      
      // Check if we have trace data for this node
      const traceGroup = getAgentTrace(nodeId);
      
      // Show modal with node details and any available trace data
      setTraceModalState({
        isVisible: true,
        nodeId: nodeId,
        nodeName: nodeDetails.title,
        traceGroup: traceGroup,
        nodeDescription: nodeDetails.description
      });
    }
  }, []);
  
  // Handle trace group expanded events from chat interface
  const handleTraceGroupExpanded = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.traceGroup) {
      const { traceGroup } = customEvent.detail;
      console.log('TraceGroup expanded in chat, activating nodes in flow diagram:', traceGroup);

      // Map to the correct node ID
      let nodeId = traceGroup.agentId || '';
      
      // If we don't have a direct agent ID, try to map from the agent type
      if (!nodeId && traceGroup.originalAgentType) {
        nodeId = collaboratorToNodeId(traceGroup.originalAgentType);
      }
      
      if (nodeId) {
      // Activate the agent node - add noAnimation flag for supervisor agent
      console.log(`Activating agent node ${nodeId} from trace group expansion`);
      const skipAnimation = nodeId === 'supervisor-agent';
      activateAgent(nodeId, traceGroup, { noAnimation: skipAnimation });
        
        // If this is the supervisor, also activate its sub-agents (but respect noAnimation)
        if (nodeId === 'supervisor-agent' && !skipAnimation) {
          console.log('Activating sub-agents connected to supervisor');
          // Get sub-agent edges
          const subAgentEdges = edges.filter(e => e.id.startsWith('e-supervisor-sa'));
          
          // Activate each sub-agent node
          subAgentEdges.forEach(edge => {
            let subAgentId = '';
            // Map edge ID to node ID
            if (edge.id === 'e-supervisor-sa1') subAgentId = 'order-mgmt-agent';
            else if (edge.id === 'e-supervisor-sa2') subAgentId = 'product-rec-agent';
            else if (edge.id === 'e-supervisor-sa3') subAgentId = 'personalization-agent';
            else if (edge.id === 'e-supervisor-sa4') subAgentId = 'ts-agent';
            
            if (subAgentId) {
              // Create a simplified trace group for the sub-agent
              const subAgentTraceGroup: TraceGroup = {
                id: `trace-from-supervisor-${Date.now()}-${subAgentId}`,
                type: 'trace-group',
                sender: 'bot',
                dropdownTitle: `${subAgentId.replace('-agent', '')} Trace`,
                agentId: subAgentId,
                originalAgentType: subAgentId.replace('-agent', ''),
                tasks: [{
                  title: 'Processing request',
                  stepNumber: 1,
                  content: 'Processing request from supervisor',
                  timestamp: Date.now()
                }],
                text: 'Agent trace',
                startTime: Date.now(),
                lastUpdateTime: Date.now()
              };
              
              // Activate the sub-agent
              activateAgent(subAgentId, subAgentTraceGroup);
            }
          });
        }
      }
    }
  }, [activateAgent, edges]);

  // Handler for reset events
  const handleFlowReset = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    const resetCompletedStates = customEvent.detail?.resetCompletedStates !== false;
    
    console.log(`🔄 Handling flow reset request. Reset completed states: ${resetCompletedStates}`);
    
    // Reset nodes to remove processing and optionally completed states
    setNodes(nodes => 
      nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          isProcessing: false,
          processingComplete: resetCompletedStates ? false : node.data?.processingComplete,
          // Keep other data properties intact
          traceGroup: node.data?.traceGroup // Preserve trace data for reference
        },
        className: '' // Remove any special classes
      }))
    );
    
    // Reset edges to remove animations and active states
    setEdges(edges => 
      edges.map(edge => ({
        ...edge,
        data: {
          ...edge.data,
          isActive: false,
          // Maintain call count if not resetting completed states
          callCount: resetCompletedStates ? 0 : edge.data?.callCount
        },
        animated: false,
        style: { 
          ...edge.style,
          stroke: undefined, // Reset to default stroke color
          strokeWidth: undefined // Reset to default stroke width
        }
      }))
    );
    
    // Reset response complete state if resetting completed states
    if (resetCompletedStates) {
      setIsResponseComplete(false);
    }
    
    // Reset active collaborators
    setActiveCollaborators(new Set());
    
    // Reset edge stats if resetting completed states
    if (resetCompletedStates) {
      setEdgeStats({});
    }
    
    console.log('Flow reset complete');
  }, [setNodes, setEdges]);

  // Override setTimeout and setInterval to track all timeouts and intervals
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Store references to the original functions
      const originalSetTimeout = window.setTimeout;
      const originalSetInterval = window.setInterval;
      const originalClearTimeout = window.clearTimeout;
      const originalClearInterval = window.clearInterval;
      
      // Override setTimeout to track timers
      window.setTimeout = function(handler, timeout, ...args) {
        const id = originalSetTimeout(handler, timeout, ...args);
        if (!window.__activeTimers) window.__activeTimers = [];
        window.__activeTimers.push(id);
        return id;
      } as any;
      
      // Override setInterval to track intervals
      window.setInterval = function(handler, timeout, ...args) {
        const id = originalSetInterval(handler, timeout, ...args);
        if (!window.__activeIntervals) window.__activeIntervals = [];
        window.__activeIntervals.push(id);
        return id;
      } as any;
      
      // Override clearTimeout to remove from tracking array
      window.clearTimeout = function(id) {
        if (window.__activeTimers) {
          const index = window.__activeTimers.indexOf(id);
          if (index !== -1) window.__activeTimers.splice(index, 1);
        }
        return originalClearTimeout(id);
      } as any;
      
      // Override clearInterval to remove from tracking array
      window.clearInterval = function(id) {
        if (window.__activeIntervals) {
          const index = window.__activeIntervals.indexOf(id);
          if (index !== -1) window.__activeIntervals.splice(index, 1);
        }
        return originalClearInterval(id);
      } as any;
      
      // Return cleanup function to restore original functions
      return () => {
        window.setTimeout = originalSetTimeout;
        window.setInterval = originalSetInterval;
        window.clearTimeout = originalClearTimeout;
        window.clearInterval = originalClearInterval;
      };
    }
  }, []);

  // Global emergency shutdown function to forcibly stop all processing
  const emergencyShutdown = useCallback((event?: Event) => {
    //console.log("🚨 EMERGENCY SHUTDOWN - Forcibly stopping all processing");
    
    // Use the global kill switch if available
    if (typeof window !== 'undefined' && window.__killAllProcessing) {
      window.__killAllProcessing();
      return;
    }
    
    // Fallback if kill switch not available
    // Set global processing flag (declared in agentTraceStorage.ts)
    if (typeof window !== 'undefined') {
      window.__processingComplete = true;
    }
    
    // Force isPollingActive to false
    setIsPollingActive(false);
    
    // Force response complete
    setIsResponseComplete(true);
    
    // Clear all intervals and timeouts
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    
    // Reset all nodes to complete state
    setNodes(nodes => 
      nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          isProcessing: false,
          processingComplete: true
        },
        className: 'node-complete'
      }))
    );
    
    // Reset all edges
    setEdges(edges => 
      edges.map(edge => ({
        ...edge,
        data: {
          ...edge.data,
          isActive: false
        },
        animated: false,
        style: { 
          ...edge.style,
          stroke: undefined,
          strokeWidth: undefined
        }
      }))
    );
    
    console.log("Emergency shutdown complete - all processing stopped");
  }, [setEdges, setNodes]);

  // Effect for DOM event listeners
  useEffect(() => {
    // Listen for agent node updates with trace data
    document.addEventListener('agentNodeUpdate', handleTraceUpdate);
    
    // Listen for agent trace updates
    document.addEventListener('agentTraceUpdated', handleTraceUpdate);
    
    // Listen for processing state updates
    document.addEventListener('agentProcessingUpdate', handleProcessingUpdate);
    
    // Listen for node click events from CustomAgentNode
    document.addEventListener('agentNodeClicked', handleNodeClicked);
    
    // Listen for trace group expanded events from chat
    document.addEventListener('traceGroupExpanded', handleTraceGroupExpanded);
    
    // Listen for flow reset events
    document.addEventListener('resetReactFlow', handleFlowReset);
    document.addEventListener('flowAnimationReset', handleFlowReset);
    
    // Listen for both completion events (critical for stopping infinite loops)
    document.addEventListener('allProcessingComplete', emergencyShutdown);
    
    // Listen for force shutdown events - but with special handling to prevent recursion
    document.addEventListener('forceShutdownAllProcessing', (event) => {
      // Check if this event came from the kill switch itself
      if ((event as CustomEvent).detail?.fromKillSwitch) {
        // Just do the UI updates without calling the kill switch again
        console.log("🔄 Received forced shutdown from kill switch - updating UI only");
        
        // Force isPollingActive to false
        setIsPollingActive(false);
        
        // Force response complete
        setIsResponseComplete(true);
        
        // Reset all nodes to complete state
        setNodes(nodes => 
          nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              isProcessing: false,
              processingComplete: true
            },
            className: 'node-complete'
          }))
        );
        
        // Reset all edges
        setEdges(edges => 
          edges.map(edge => ({
            ...edge,
            data: {
              ...edge.data,
              isActive: false
            },
            animated: false,
            style: { 
              ...edge.style,
              stroke: undefined,
              strokeWidth: undefined
            }
          }))
        );
      } else {
        // Normal processing - call the emergency shutdown handler
        emergencyShutdown(event);
      }
    });
    
    // Auto-kill all processing after 8 seconds of user message sent
    // This is a fail-safe to prevent infinite loops no matter what
    document.addEventListener('userMessageSent', () => {
      console.log("⏲️ User message detected - setting 8 second auto-kill timer");
      const killTimerId = setTimeout(() => {
        console.log("⏲️ Auto-kill timer triggered after 8 seconds");
        if (typeof window !== 'undefined' && window.__killAllProcessing) {
          window.__killAllProcessing();
        } else {
          emergencyShutdown();
        }
      }, 8000);
      
      // Store the timer ID for potential cancellation using any type
      if (window.__activeTimers) {
        window.__activeTimers.push(killTimerId as any);
      }
      
      // Also schedule an immediate kill for any existing processing
      // Emergency failsafe that runs in 1ms
      setTimeout(() => {
        console.log("🚨 IMMEDIATE EMERGENCY FAILSAFE - Creating kill handler");
        
        // Create a mutation observer to kill any new DOM changes
        const observer = new MutationObserver(() => {
          if (window.__processingComplete) return;
          
          console.log("🔴 DOM changed, activating kill switch");
          window.__processingComplete = true;
          if (window.__killAllProcessing) window.__killAllProcessing();
        });
        
        // Watch for any changes to the document
        observer.observe(document, { 
          childList: true, 
          subtree: true,
          attributes: true
        });
        
        // Also directly dispatch a custom event to simulate message reception
        // and trigger the kill switch
        document.dispatchEvent(new CustomEvent('manualKillSwitchEvent', {
          detail: { source: 'immediate-failsafe' }
        }));
      }, 5000);
    });
    
    // Create a 4-second recurring emergency failsafe timer 
    // This tries to detect when all other mechanisms have failed
    const emergencyTimer = setInterval(() => {
      const lastActivity = Date.now() - lastActivityTimeRef.current;
      if (lastActivity > 4000) { // 4 seconds with no activity
        //console.log(`🔥 RECURRING FAILSAFE: No activity for ${Math.floor(lastActivity/1000)}s - triggering emergency shutdown`);
        emergencyShutdown();
        clearInterval(emergencyTimer); // Clear ourselves
      }
    }, 4000);
    
    // Listen for final response (key phrases that indicate process should be complete)
    document.addEventListener('message', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.onUpdateChat?.assistant) {
          const text = data.onUpdateChat.assistant;
          // Look for phrases that suggest the response is complete
          if (text && typeof text === 'string' && (
            text.includes("Can I help you with anything else") ||
            text.includes("Is there anything else") ||
            text.includes("Is there something else") ||
            text.includes("In conclusion") ||
            text.includes("To summarize")
          )) {
            console.log("🏁 Final response detected - triggering shutdown");
            emergencyShutdown();
          }
        }
      } catch (e) {
        // Ignore errors parsing message data
      }
    });
    
    // Check for existing trace data in storage for each agent node on mount
    setTimeout(() => {
      nodes.forEach(node => {
        const existingTrace = getAgentTrace(node.id);
        if (existingTrace) {
          console.log(`Found existing trace data for node ${node.id} in storage`);
          activateAgent(node.id, existingTrace);
        }
      });
    }, 300); // Small delay to ensure component is fully mounted
    
    return () => {
      // Clean up event listeners when component unmounts
      document.removeEventListener('agentNodeUpdate', handleTraceUpdate);
      document.removeEventListener('agentTraceUpdated', handleTraceUpdate);
      document.removeEventListener('agentProcessingUpdate', handleProcessingUpdate);
      document.removeEventListener('agentNodeClicked', handleNodeClicked);
      document.removeEventListener('traceGroupExpanded', handleTraceGroupExpanded);
      document.removeEventListener('resetReactFlow', handleFlowReset);
      document.removeEventListener('flowAnimationReset', handleFlowReset);
    };
  }, [activateAgent, handleProcessingUpdate, handleTraceUpdate, handleTraceGroupExpanded, handleFlowReset, nodes]);
  
  // Handle node click to show details or display trace data
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    try {
      // Important: For agent nodes, we'll prioritize showing trace data in the node itself
      const isAgentNode = node.id.includes('-agent') || node.id === 'routing-classifier' || node.id === 'supervisor-agent';
      const isBrowserNode = node.id === 'customer';
      const isSupervisorNode = node.id === 'supervisor-agent';
      
      // Special handling for supervisor node - explicitly deactivate all connected edges FIRST
      // before any other processing to prevent edge animations on node click
      if (isSupervisorNode) {
        // Find all connected edges to supervisor
        const supervisorEdges = edges.filter(edge => 
          edge.source === 'supervisor-agent' || 
          edge.target === 'supervisor-agent' ||
          edge.id.includes('supervisor')
        );
        
        // Immediately remove active class from all supervisor edges
        supervisorEdges.forEach(edge => {
          const edgeElement = document.getElementById(edge.id);
          if (edgeElement) {
            edgeElement.classList.remove('active');
          }
        });
        
        // Also update edge state through React
        setEdges(edges => 
          edges.map(e => {
            if (supervisorEdges.some(se => se.id === e.id)) {
              return {
                ...e,
                data: {
                  ...e.data,
                  isActive: false
                },
                animated: false
              };
            }
            return e;
          })
        );
      }
      
      // Check if this node has any trace data before animating
      // Use strict ownership validation to ensure we only consider traces that belong to this node
      const existingTrace = getAgentTrace(node.id, undefined, true);
      const hasValidTraceData = existingTrace && 
                              existingTrace.tasks && 
                              Array.isArray(existingTrace.tasks) && 
                              existingTrace.tasks.length > 0;
      
      // Always notify that a node has been selected - this enables trace data streaming to the node
      // Force noAnimation to true for supervisor-agent to prevent edge animations
      const noAnimation = !hasValidTraceData || isSupervisorNode;
      const nodeSelectionEvent = new CustomEvent('agentNodeSelected', {
        detail: {
          nodeId: node.id,
          noAnimation: noAnimation, // Force noAnimation true for supervisor node
          timestamp: Date.now()
        }
      });
      document.dispatchEvent(nodeSelectionEvent);
      
      // Special handling for supervisor node - explicitly deactivate all connected edges
      if (isSupervisorNode) {
        // Find all connected edges to supervisor
        const supervisorEdges = edges.filter(edge => 
          edge.source === 'supervisor-agent' || 
          edge.target === 'supervisor-agent' ||
          edge.id.includes('supervisor')
        );
        
        // Immediately remove active class from all supervisor edges
        supervisorEdges.forEach(edge => {
          const edgeElement = document.getElementById(edge.id);
          if (edgeElement) {
            edgeElement.classList.remove('active');
          }
        });
        
        // Also update edge state through React
        setEdges(edges => 
          edges.map(e => {
            if (supervisorEdges.some(se => se.id === e.id)) {
              return {
                ...e,
                data: {
                  ...e.data,
                  isActive: false
                },
                animated: false
              };
            }
            return e;
          })
        );
      }
      
      // Special handling for browser node to show both sent and received messages
      if (isBrowserNode) {
        
        // First check if we already have browser trace data
        // For browser nodes, we want to be less strict with trace ownership
        const browserTrace = getAgentTrace('customer', undefined, false);
        
        // If we have direct browser trace data, use it
        if (browserTrace && browserTrace.tasks && browserTrace.tasks.length > 0) {
          
          // Enhance trace display by sorting tasks by timestamp and ensuring proper direction labels
          const enhancedBrowserTrace = {
            ...browserTrace,
            tasks: [...browserTrace.tasks].sort((a, b) => a.timestamp - b.timestamp).map(task => ({
              ...task,
              // Ensure direction is set based on title if not already present
              _direction: (task as any)._direction || 
                         (task.title.includes('User Input') ? 'outgoing' : 
                          task.title.includes('System Response') ? 'incoming' : undefined)
            }))
          };
          
          setTraceModalState({
            isVisible: true,
            nodeId: node.id,
            nodeName: 'Browser',
            traceGroup: enhancedBrowserTrace,
            nodeDescription: 'Shows both messages sent from the browser and responses received by the browser'
          });
          return;
        }
        
        // Fallback: Helper function to create a combined trace from supervisor
        const createCombinedTrace = () => {
          // Get traces from supervisor - this has both user inputs and system responses
          const supervisorTrace = getAgentTrace('supervisor-agent');
          
          // Create a new empty trace group specifically for the browser view
          const combinedTrace: TraceGroup = {
            id: `browser-combined-${Date.now()}`,
            type: 'trace-group',
            sender: 'bot',
            dropdownTitle: 'Browser Messages',
            agentId: 'customer',
            originalAgentType: 'Browser',
            tasks: [],
            text: 'Browser communication',
            startTime: Date.now(),
            lastUpdateTime: Date.now()
          };
          
          // If we have supervisor trace, extract user inputs and system responses as fallback
          if (supervisorTrace && supervisorTrace.tasks && supervisorTrace.tasks.length > 0) {
            const allTasks = [];
            
            // IMPORTANT: Create a USER INPUT task first
            // This will force the display to show the user input separately from responses
            const userInputTasks = [];
            const responseTasks = [];
            
            // Process all tasks from supervisor to extract user inputs and responses
            supervisorTrace.tasks.forEach(task => {
              // Extract content from the task or its subtasks
              const extractContent = (task) => {
                if (!task) return null;
                
                // First check direct content
                if (task.content) return task.content;
                
                // Then check subtasks (often user input is in Model Input subtask)
                if (task.subTasks && task.subTasks.length > 0) {
                  // Look for Model Input subtasks first
                  const modelInputSubtask = task.subTasks.find(st => 
                    st.title.includes('Model Input') || st.title.includes('Input')
                  );
                  
                  if (modelInputSubtask && modelInputSubtask.content) {
                    return modelInputSubtask.content;
                  }
                  
                  // Otherwise just use the first subtask content
                  return task.subTasks[0].content;
                }
                
                return null;
              };
              
              // Create user input tasks (Step 1 or early model inputs are usually user input)
              if ((task.stepNumber === 1 || 
                  (task.title && task.title.includes('Step 1')) || 
                  (task.title && task.title.includes('Model Input') && !task.title.includes('Response'))) && 
                  !task.title.includes('Final Response')) {
                
                const content = extractContent(task);
                if (content) {
                  // Create a new unique task for user input
                  userInputTasks.push({
                    id: `user-input-${Date.now()}-${userInputTasks.length}`,
                    stepNumber: 1, // Always make user input step 1
                    title: `User Input (${((task.timestamp - supervisorTrace.startTime) / 1000).toFixed(2)}s)`,
                    content: content,
                    timestamp: task.timestamp || supervisorTrace.startTime,
                    _direction: 'outgoing'
                  });
                }
              }
              
              // Create response tasks (Final Response tasks are system outputs)
              if (task.title && (task.title.includes('Final Response') || 
                  task.title.includes('Response:')) || 
                  (task.content && task.content.toString().includes('final response'))) {
                
                const content = extractContent(task);
                if (content) {
                  // Create a new unique task for system response
                  responseTasks.push({
                    id: `system-response-${Date.now()}-${responseTasks.length}`,
                    stepNumber: 2, // Always make response step 2
                    title: `System Response (${((task.timestamp - supervisorTrace.startTime) / 1000).toFixed(2)}s)`,
                    content: content,
                    timestamp: task.timestamp || supervisorTrace.startTime + 1000, // Ensure response comes after input
                    _direction: 'incoming'
                  });
                }
              }
            });
            
            // If we couldn't find specific tasks, create fallbacks
            if (userInputTasks.length === 0 && supervisorTrace.tasks.length > 0) {
              // Create a generic user input task from the first task
              const firstTask = supervisorTrace.tasks[0];
              userInputTasks.push({
                id: `fallback-user-input-${Date.now()}`,
                stepNumber: 1,
                title: `User Input (${((firstTask.timestamp - supervisorTrace.startTime) / 1000).toFixed(2)}s)`,
                content: firstTask.content || "User query",
                timestamp: firstTask.timestamp || supervisorTrace.startTime,
                _direction: 'outgoing'
              });
            }
            
            if (responseTasks.length === 0 && supervisorTrace.tasks.length > 1) {
              // Create a generic response task from the last task
              const lastTask = supervisorTrace.tasks[supervisorTrace.tasks.length - 1];
              responseTasks.push({
                id: `fallback-system-response-${Date.now()}`,
                stepNumber: 2,
                title: `System Response (${((lastTask.timestamp - supervisorTrace.startTime) / 1000).toFixed(2)}s)`,
                content: lastTask.content || "Processing response...",
                timestamp: lastTask.timestamp || supervisorTrace.startTime + 1000,
                _direction: 'incoming'
              });
            }
            
            // Combine both types of tasks, keeping them in separate steps
            combinedTrace.tasks = [...userInputTasks, ...responseTasks];
            combinedTrace.startTime = supervisorTrace.startTime;
            
            // If supervisor trace is complete, mark combined trace as complete
            if (supervisorTrace.isComplete) {
              combinedTrace.isComplete = true;
              combinedTrace.finalElapsedTime = ((supervisorTrace.lastUpdateTime - supervisorTrace.startTime) / 1000).toFixed(2);
            }
          }
          
          return combinedTrace;
        };
        
        // Create combined trace group
        const combinedTraceGroup = createCombinedTrace();
        
        if (combinedTraceGroup && combinedTraceGroup.tasks.length > 0) {
          // Show the trace modal with browser traces
          setTraceModalState({
            isVisible: true,
            nodeId: node.id,
            nodeName: 'Browser',
            traceGroup: combinedTraceGroup,
            nodeDescription: 'Shows both messages sent from the browser and responses received by the browser'
          });
          return;
        } else {
          // Show empty browser modal
          setTraceModalState({
            isVisible: true,
            nodeId: node.id,
            nodeName: 'Browser',
            traceGroup: {
              id: `browser-empty-${Date.now()}`,
              type: 'trace-group',
              sender: 'bot',
              dropdownTitle: 'Browser Messages',
              agentId: 'customer',
              originalAgentType: 'Browser',
              tasks: [],
              text: 'No browser communication yet',
              startTime: Date.now(),
              lastUpdateTime: Date.now()
            },
            nodeDescription: 'No browser communication available yet'
          });
          return;
        }
      }
      
      // For agent nodes, try to show trace data directly in the node
      if (isAgentNode) {
        // Map node ID to its corresponding edge ID
        let edgeId;
        if (node.id === 'order-mgmt-agent') {
          edgeId = 'e-supervisor-sa1';
        } else if (node.id === 'product-rec-agent') {
          edgeId = 'e-supervisor-sa2';
        } else if (node.id === 'personalization-agent') {
          edgeId = 'e-supervisor-sa3';
        } else if (node.id === 'ts-agent') {
          edgeId = 'e-supervisor-sa4';
        } else if (node.id === 'routing-classifier') {
          edgeId = 'e-supervisor-sa0';
        } else if (node.id === 'customer') {
          edgeId = 'e-customer-supervisor';
        } else {
          edgeId = `e-supervisor-${node.id.replace('-agent', '')}`;
        }
        
        // Check all available trace sources for this node with strict ownership validation
        const directTraceGroup = edgeTraceGroups[edgeId];
        let traceGroup = null;
        
        // Use directTraceGroup only if it actually belongs to this node
        if (directTraceGroup && validateTraceOwnership(node.id, directTraceGroup)) {
          traceGroup = directTraceGroup;
        } else {
          // If no direct valid trace group, check the node storage with strict validation
          traceGroup = getAgentTrace(node.id, undefined, true);
        }
                
        // Set the processing state on the node to show it's active if we have trace data
        if (traceGroup) {
          setNodes(nodes => 
            nodes.map(n => {
              if (n.id === node.id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    isProcessing: true,
                    processingComplete: traceGroup?.isComplete || false
                  }
                };
              }
              return n;
            })
          );
          
          // Show trace data in the modal
          setTraceModalState({
            isVisible: true,
            nodeId: node.id,
            nodeName: nodeDetailsMap[node.id]?.title || node.id,
            traceGroup,
            nodeDescription: nodeDetailsMap[node.id]?.description || ''
          });
          return; // Exit early after showing modal
        }
        
        // If no valid trace data, show the modal with null trace group
        // This will display "No trace data available for this agent"
        setTraceModalState({
          isVisible: true,
          nodeId: node.id,
          nodeName: nodeDetailsMap[node.id]?.title || node.id,
          traceGroup: null,
          nodeDescription: nodeDetailsMap[node.id]?.description || ''
        });
        return;
      }
      
      // Fallback to showing node details
      setSelectedNode(node.id);
      setIsModalVisible(true);
    } catch (error) {
      console.error("Error in node click handler:", error);
      // Default fallback to node details
      if (node && node.id) {
        setSelectedNode(node.id);
        setIsModalVisible(true);
      }
    }
  }, [edgeTraceGroups, setNodes]);

  const handleCloseTraceModal = () => {
    setTraceModalState(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  // Get a reference to the ReactFlow instance
  const onInit = useCallback((reactFlowInstance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = reactFlowInstance;
    // Ensure fit view is run on initialization
    setTimeout(() => {
      // First fit view to ensure all nodes are visible 
      reactFlowInstance.fitView({ padding: 0.02, includeHiddenNodes: false });
      // Then zoom in slightly more for better visibility
      reactFlowInstance.zoomTo(0.7);
    }, 200); // Short delay to ensure nodes are properly positioned
  }, []);
  
  // Effect to ensure fit view is run when nodes or edges change
  useEffect(() => {
    if (reactFlowInstanceRef.current) {
      setTimeout(() => {
        // First fit view to ensure all nodes are visible 
        reactFlowInstanceRef.current?.fitView({ padding: 0.05, includeHiddenNodes: false });
        // Then zoom in slightly more for better visibility
        reactFlowInstanceRef.current?.zoomTo(1.2);
      }, 50);
    }
  }, [nodes.length, edges.length]); // Run when the number of nodes/edges changes
  
  // Track if initial fit view has been applied
  const initialFitViewApplied = useRef(false);
  
  // Store last known trace data state to detect changes
  const lastKnownTraceData = useRef<Record<string, string>>({});
  
  // Track the conversation completion state for polling
  const [isPollingActive, setIsPollingActive] = useState(true);
  
  // Effect to stop polling when the response is complete
  useEffect(() => {
    if (isResponseComplete) {
      setIsPollingActive(false);
    }
  }, [isResponseComplete]);
  
  // Track last conversation completion time to avoid reactivating old traces
  const lastConversationEndTime = useRef(0);
  
  // Flag to track if we've already shown the starting polling message
  const hasLoggedStartMessage = useRef(false);
  
  // Track last activity time to stop polling when inactive
  const lastActivityTimeRef = useRef<number>(Date.now());
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize the kill switch system when the component mounts
  useEffect(() => {
    //console.log("Initializing kill switch system for AgentFlowPanel");
    setupGlobalKillSwitch();
    
    // Listen for final message events
    const handleFinalMessage = (e: Event) => {
      const event = e as CustomEvent;
      console.log("Final message detected in AgentFlowPanel", event.detail?.preserveTraceData ? "(preserve mode)" : "");
      
      if (!event.detail?.preserveTraceData) {
        // If not in preserve mode, mark all nodes as complete immediately
        setIsResponseComplete(true);
        
        // Update all nodes to show complete status
        setNodes(nodes => 
          nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              isProcessing: false,
              processingComplete: true
            },
            className: 'node-complete'
          }))
        );
        
        // Update all edges to stop animations
        setEdges(edges => 
          edges.map(edge => ({
            ...edge,
            animated: false,
            data: {
              ...edge.data,
              isActive: false
            }
          }))
        );
      }
    };
    
    document.addEventListener('finalMessageDetected', handleFinalMessage);
    document.addEventListener('finalMessageRendered', handleFinalMessage);
    
    return () => {
      document.removeEventListener('finalMessageDetected', handleFinalMessage);
      document.removeEventListener('finalMessageRendered', handleFinalMessage);
    };
  }, [setNodes, setEdges]);
  
  // Function to update last activity time
  const updateActivityTime = useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    
    // Clear any existing inactivity timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    
    // Set a new inactivity timeout - convert animations to solid blue lines after 2 seconds of no trace updates
    inactivityTimeoutRef.current = setTimeout(() => {
      console.log("⏱️ 2-second inactivity timeout reached - freezing animations and setting solid blue lines");
      
      // Stop polling
      setIsPollingActive(false);
      
      // Track which edges were active for styling
      const activeEdgeIds = new Set<string>();
      
      // Find all active edges and store their IDs
      const activeEdges = document.querySelectorAll('.react-flow__edge-path.active');
      activeEdges.forEach((edge) => {
        const edgeId = edge.id;
        if (edgeId) activeEdgeIds.add(edgeId);
        
        // Remove active animation class
        edge.classList.remove('active');
        
        // Add solid-blue class for static styling
        edge.classList.add('solid-blue');
        
        // Set a solid blue stroke directly on the element
        (edge as SVGElement).style.stroke = '#2196F3';
        (edge as SVGElement).style.strokeWidth = '3px';
      });
      
      // Also update edge state through React
      setEdges(edges => 
        edges.map(edge => {
          const wasActive = activeEdgeIds.has(edge.id) || edge.data?.isActive === true;
          
          return {
            ...edge,
            data: {
              ...edge.data,
              isActive: false,
              wasFrozenActive: wasActive // Track which edges were active before freezing
            },
            animated: false,
            // Apply solid blue styling to previously active edges
            style: wasActive ? {
              ...edge.style,
              stroke: '#2196F3',
              strokeWidth: 3
            } : edge.style
          };
        })
      );
      
      // Dispatch event to notify other components
      const freezeAnimationsEvent = new CustomEvent('freezeAnimations', {
        detail: { timestamp: Date.now(), preserveActiveEdges: true }
      });
      document.dispatchEvent(freezeAnimationsEvent);
    }, 2000); // 2 seconds of inactivity
  }, []);
  
  // CRITICAL FIX: Complete disable of local storage polling mechanism
  // This is a replacement for the previous polling effect
  useEffect(() => {
    // Only run once, then permanently remove all trace data polling
    
    // Immediately check if we should be completely disabled
    if (typeof window !== 'undefined' && window.__processingComplete) {
      return;
    }
    
    // If response is complete, set the timestamp and force all polling to stop
    if (isResponseComplete) {
      if (lastConversationEndTime.current === 0) {
        lastConversationEndTime.current = Date.now();
        console.log(`Setting conversation end timestamp: ${lastConversationEndTime.current}`);
        
        // Force all polling to stop
        setIsPollingActive(false);
        
        // Force processing complete global flag
        if (typeof window !== 'undefined') {
          window.__processingComplete = true;
        }
        
        // Trigger emergency kill switch if available
        if (typeof window !== 'undefined' && window.__killAllProcessing) {
          window.__killAllProcessing();
        }
        
        // Force cleanup all active processing states
        setNodes(nodes => 
          nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              isProcessing: false,
              processingComplete: true
            },
            className: 'node-complete'
          }))
        );
        
        // Clear all localStorage data for traces to prevent future detections
        try {
          localStorage.removeItem('agent-trace-cache');
        } catch (e) {
          console.error("Error clearing localStorage:", e);
        }
      }
      
      // No polling at all when response is complete
      return;
    }
    
    // Skip polling if not active - we will NEVER resume polling once stopped
    if (!isPollingActive) {
      // Clear any inactivity timeout
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      
      // Permanently remove all trace data to prevent future polls from detecting it
      try {
        localStorage.removeItem('agent-trace-cache');
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
      
      return;
    }
    
    // One-time setup of emergency shutdown timer - guaranteed to run after 5 seconds
    const emergencyTimer = setTimeout(() => {      
      // Force polling to stop permanently
      setIsPollingActive(false);
      
      // Set global processing flag
      if (typeof window !== 'undefined') {
        window.__processingComplete = true;
        
        // Clear all storage to prevent future polls
        try {
          localStorage.removeItem('agent-trace-cache');
        } catch (e) {
          console.error("Error clearing localStorage:", e);
        }
      }
      
      // Force all nodes to complete state
      setNodes(nodes => 
        nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            isProcessing: false,
            processingComplete: true
          },
          className: 'node-complete'
        }))
      );
    }, 5000);
    
    // Track the emergency timer for cleanup
    if (window.__activeTimers) {
      window.__activeTimers.push(emergencyTimer as any);
    }
    
    let changeDetected = false;
    
    const checkTraceStorage = () => {
      // Skip polling after response is complete
      if (isResponseComplete) {
        return;
      }
      
      try {
        // Read the current trace storage from localStorage
        const traceStorageRaw = localStorage.getItem('agent-trace-cache');
        if (!traceStorageRaw) return;
        
        const traceStorage = JSON.parse(traceStorageRaw);
        const nodeIds = Object.keys(traceStorage);
        
        // Check each node for changes
        nodeIds.forEach(nodeId => {
          const traceData = traceStorage[nodeId];
          if (!traceData) return;
          
          // Skip if this trace is from a completed conversation
          if (isResponseComplete && traceData.lastUpdated < lastConversationEndTime.current) {
            return;
          }
          
          // Create a hash of the trace data to detect changes
          const traceHash = `${nodeId}-${traceData.traceGroup?.id || ''}-${traceData.lastUpdated || ''}`;
          const lastHash = lastKnownTraceData.current[nodeId];
          
          // If this is new data or changed data, activate the node
          if (!lastHash || lastHash !== traceHash) {
            changeDetected = true; // Mark that we found a change
            updateActivityTime(); // Update activity time since we detected a change
            
            // Save the new hash
            lastKnownTraceData.current[nodeId] = traceHash;
            
            // Skip processing if we're already in a completed state
            // This prevents reactivating nodes after conversation ends
            if (isResponseComplete) {
              return;
            }
            

            // Get the trace group from storage
            const traceGroup = traceData.traceGroup;
            if (traceGroup) {
              // Check if this agent is already marked as complete, if so don't reactivate
              if (traceGroup.isComplete) {
                return;
              }
                          
              // Force immediate DOM update for animation
              const nodeElement = document.getElementById(nodeId);
              if (nodeElement) {
                nodeElement.classList.add('node-processing');
              }
              
              // Find connected edges for direct DOM manipulation
              const connectedEdges = findConnectedEdges(nodeId);
              connectedEdges.forEach(edge => {
                const edgeElement = document.getElementById(edge.id);
                if (edgeElement) {
                  edgeElement.classList.add('active');
                }
              });
              
              // Also use React state updates for sustainable state management
              activateAgent(nodeId, traceGroup);
            }
          }
        });
        
        // If no change was detected in this poll cycle, check if we're inactive
        if (!changeDetected) {
          const inactiveTime = Date.now() - lastActivityTimeRef.current;
          // If no activity for more than 3 seconds, check if we should stop polling
          if (inactiveTime > 3000) {
            
            // Check if all nodes are complete or inactive
            let allNodesComplete = true;
            nodes.forEach(node => {
              // If any node is still processing, we're not done
              if (node.data?.isProcessing && !node.data?.processingComplete) {
                allNodesComplete = false;
              }
            });
            
            if (allNodesComplete) {
              setIsPollingActive(false);
            }
          }
        }
      } catch (error) {
        console.error("Error checking trace storage:", error);
      }
    };
    
    // Initial check
    checkTraceStorage();
    
    // Set up polling interval - start with more frequent checks, then slow down
    // Use 250ms for first 5 seconds, then 500ms if still active
    const pollInterval = (Date.now() - lastActivityTimeRef.current < 5000) ? 250 : 500;
    const interval = setInterval(checkTraceStorage, pollInterval);
    
    // Clean up
    return () => {
      clearInterval(interval);
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [activateAgent, findConnectedEdges, isPollingActive, isResponseComplete, nodes, setNodes, updateActivityTime]);

  // Enhanced effect to guarantee fit view runs on page load and completes successfully
  useEffect(() => {
    // Series of timed fit view operations to ensure proper rendering
    if (!initialFitViewApplied.current && reactFlowInstanceRef.current) {      
      // Initial fit view
      reactFlowInstanceRef.current.fitView({ padding: 0.1, includeHiddenNodes: false });
      
      // Additional fit view attempts with increasing delays
      const timers = [
        setTimeout(() => {
          if (reactFlowInstanceRef.current) {
            reactFlowInstanceRef.current.fitView({ padding: 0.1, includeHiddenNodes: false });
          }
        }, 200),
        
        setTimeout(() => {
          if (reactFlowInstanceRef.current) {
            reactFlowInstanceRef.current.fitView({ padding: 0.1, includeHiddenNodes: false });
            initialFitViewApplied.current = true;
          }
        }, 500),
        
        setTimeout(() => {
          if (reactFlowInstanceRef.current) {
            reactFlowInstanceRef.current.fitView({ padding: 0.1, includeHiddenNodes: false });
          }
        }, 2000)
      ];
      
      return () => {
        // Cleanup all timers on unmount
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [reactFlowInstanceRef.current]); // Run when ref is populated
  
  return (
    <div style={{ height, position: 'relative' }}>
      <FlowContainer height={height}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={onInit}
          nodesDraggable={false}
          fitViewOptions={{ padding: 0.1, includeHiddenNodes: false }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          // Disable auto-fit view to lock position
          fitView={false}
          // Lock the user's ability to zoom/pan
          zoomOnScroll={false}
          panOnScroll={false}
          panOnDrag={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          // Set default classes for nodes to avoid need for nodeClassName prop
          // We handle this through the className property on the node objects directly
          onNodesChange={(changes) => {
            // Custom nodes change handler to ensure processing classes are preserved
            const nodesWithClasses = applyNodeChanges(changes, nodes).map(node => {
              // Preserve any processing classes during node changes
              if (node.data?.isProcessing) {
                return {
                  ...node,
                  className: `${node.className || ''} node-processing`.trim()
                };
              } else if (node.data?.processingComplete) {
                return {
                  ...node,
                  className: `${node.className || ''} node-complete`.trim()
                };
              }
              return node;
            });
            
            setNodes(nodesWithClasses);
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </FlowContainer>
      
      {/* Trace Modal */}
      <TraceModal
        visible={traceModalState.isVisible}
        onDismiss={handleCloseTraceModal}
        traceGroup={traceModalState.traceGroup}
        nodeId={traceModalState.nodeId}
        nodeName={traceModalState.nodeName}
        nodeDescription={traceModalState.nodeDescription}
      />
    </div>
  );
};

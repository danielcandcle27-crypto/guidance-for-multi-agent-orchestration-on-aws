import { agentConfig, isRoutingClassifierAgent, getAgentTypeFromName, AGENT_TYPES } from './agentConfig';

// Types
export interface SubTask {
  title: string;
  content: string | object;
  fullJson: string | null;
  timestamp: number;
}

export interface Task {
  stepNumber: number;
  title: string;
  content?: string | object;
  fullJson?: string | null;
  timestamp: number;
  subTasks?: SubTask[];
  // Internal properties to track related tasks
  _groupId?: string;
  _parentTaskIndex?: number;
  _agentId?: string;  // Track which agent this task belongs to
  _modelInvocationId?: string;  // For identifying paired model input/output operations
  _sequenceNumber?: number;  // Track the chronological sequence of tasks regardless of stepNumber
  _isRoutingClassifierParent?: boolean;  // Marks a task as a routing classifier parent
  _finalResponseDispatched?: boolean; // Tracks if a final response has been dispatched for this task
}

export interface TraceGroup {
  id: string;
  type: 'trace-group';
  sender: 'bot';
  dropdownTitle: string;
  startTime: number;
  tasks: Task[];
  text: string;
  agentId: string; // Specific agent identifier for exact matching
  originalAgentType?: string; // Original agent type from the trace data
  orchestrationTraceType?: string; // Type of orchestration trace
  lastUpdateTime?: number; // Last time this trace group was updated
  isComplete?: boolean; // Whether this trace group has completed its work
  finalElapsedTime?: string; // Final elapsed time when trace is completed
  agentName?: string; // Agent name for routing classifier filtering
  hasFinalResponse?: boolean; // Generic flag for any agent with a final response
  isSupervisorFinalResponse?: boolean; // Whether this trace group contains a Supervisor final response
  finalResponseTimestamp?: number; // Timestamp when the final response was detected
  finalResponseContent?: string; // Content of the final response
  finalResponseProcessed?: boolean; // Whether the final response has been processed and displayed
  collaborationConfig?: { // Configuration for collaboration between agents
    supervisorWithRouting?: boolean;
    enabled?: boolean;
  };
  _debug?: { // Debug information for troubleshooting
    detectedType?: string;
    rawAgentId?: string;
    rawCollaborator?: string;
    rawAgentName?: string;
    [key: string]: any; // Allow any additional debug information
  };
}

export interface Message {
  id: string;
  type: string;
  content: React.ReactNode;
  timestamp: string;
  sortKey?: number;
}

export interface TraceState {
  messages: (Message | TraceGroup)[];
  currentTrace: string;
  currentSubTrace: string;
  traceStepCounter: { [key: string]: number };
}

// Note: AGENT_TYPES is now imported from './agentConfig'

// Normalized names and patterns for agent identification
const AGENT_PATTERNS = {
  SUPERVISOR: ['supervisor', 'unknown', 'main', 'orchestrator'],
  ROUTING_CLASSIFIER: ['routing', 'classifier', 'router'],
  PRODUCT_RECOMMENDATION: ['product', 'recommendation', 'recommend'],
  TROUBLESHOOT: ['trouble', 'issue', 'support'],
  PERSONALIZATION: ['personal', 'preference'],
  ORDER_MANAGEMENT: ['order', 'management', 'shipping']
};

// Map known agents to model names
export function getModelLabelForTrace(traceType: string): string {
  switch (traceType) {
    case AGENT_TYPES.SUPERVISOR:
    case 'Supervisor':
      return 'Nova Premier';
    case AGENT_TYPES.PRODUCT_RECOMMENDATION:
    case 'ProductRecommendation':
      return 'Nova Lite';
    case AGENT_TYPES.TROUBLESHOOT:
    case 'Troubleshoot':
      return 'DeepSeek-R1';
    case AGENT_TYPES.PERSONALIZATION:
    case 'Personalization':
      return 'Claude Sonnet 3.7 v1';
    case AGENT_TYPES.ORDER_MANAGEMENT:
    case 'OrderManagement':
      return 'Claude 3.5 Haiku';
    case AGENT_TYPES.ROUTING_CLASSIFIER:
      return 'Nova Micro V1';
    default:
      // Default to Supervisor model for unknown traces
      return 'Not detected';
  }
}

// Parse JSON trace data from string
export function parseTraceJson(traceString: string): any {
  try {
    return JSON.parse(traceString);
  } catch (e) {
    try {
      // Try to extract JSON from the string if direct parsing fails
      const jsonMatch = traceString.match(/\{.*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e2) {
      console.error('Failed to parse trace JSON:', e2);
    }
    console.error('Failed to parse trace JSON:', e);
    return null;
  }
}

// Enhanced function to identify agent type from trace data
function getAgentTypeFromTrace(traceData: any): string {
  // Handle null or undefined case
  if (!traceData) return AGENT_TYPES.SUPERVISOR;

  // Add detailed structure logging for debugging
  console.group('%c🔍 TRACE STRUCTURE ANALYSIS', 'color: #9C27B0; font-weight: bold; font-size: 12px');
  console.log('Agent name:', traceData?.agentName);
  console.log('Collaborator name:', traceData?.collaboratorName);
  console.log('Agent ID:', traceData?.agentId);
  console.log('Has routingClassifierTrace:', !!traceData?.trace?.routingClassifierTrace);
  console.log('Has orchestrationTrace:', !!traceData?.trace?.orchestrationTrace);
  console.log('Has trace_type:', traceData?.trace?.trace_type);
  
  // Check for supervisor-specific fields
  const hasSupervisorTraits = !!(
    traceData?.trace?.orchestrationTrace?.rationale ||
    traceData?.trace?.orchestrationTrace?.observation?.finalResponse ||
    traceData?.supervisorMetadata
  );
  console.log('Has supervisor traits:', hasSupervisorTraits);
  
  // Create a console table for easier debugging
  console.table({
    'agentName': traceData?.agentName,
    'collaboratorName': traceData?.collaboratorName,
    'agentId': traceData?.agentId,
    'Has routingClassifierTrace': !!traceData?.trace?.routingClassifierTrace,
    'Has orchestrationTrace': !!traceData?.trace?.orchestrationTrace,
    'Has supervisorTraits': hasSupervisorTraits
  });

  // --- PRIMARY DETECTION: Check for exact agentName match for Supervisor ---
  // This is the highest priority check as requested
  if (traceData?.agentName === 'Supervisor') {
    console.log('EXACT MATCH: agentName === Supervisor');
    
    // Ensure collaboration configuration with "supervisor with routing" is enabled
    // Add this property to the trace data for later use in UI
    if (traceData) {
      traceData.collaborationConfig = {
        supervisorWithRouting: true,
        enabled: true
      };
      console.log('Enabled supervisor with routing collaboration configuration');
    }
    
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // --- PRIMARY DETECTION: Check for ROUTING_CLASSIFIER in the ModelInvocationInput type ---
  // Now all ROUTING_CLASSIFIER traces are redirected to the Supervisor agent
  // We maintain the log statements for debugging but return AGENT_TYPES.SUPERVISOR instead
  
  // First check for type field at the top-level of the trace object
  if (traceData?.type === "ROUTING_CLASSIFIER") {
    console.log('EXACT MATCH: traceData.type === ROUTING_CLASSIFIER - returning Supervisor type');
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // Then check for agentName exact match
  if (traceData?.agentName === 'ROUTING_CLASSIFIER') {
    console.log('EXACT MATCH: agentName === ROUTING_CLASSIFIER - returning Supervisor type');
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // Comprehensive check for the ModelInvocationInput structure that has type="ROUTING_CLASSIFIER"
  // This is a direct indicator of a routing classifier operation following the example structure
  if (traceData?.trace?.orchestrationTrace?.modelInvocationInput?.type === "ROUTING_CLASSIFIER" ||
      traceData?.trace?.preProcessingTrace?.modelInvocationInput?.type === "ROUTING_CLASSIFIER" ||
      traceData?.trace?.postProcessingTrace?.modelInvocationInput?.type === "ROUTING_CLASSIFIER" ||
      traceData?.trace?.routingClassifierTrace?.modelInvocationInput?.type === "ROUTING_CLASSIFIER" ||
      // Check directly in modelInvocationInput at both top level and nested locations
      traceData?.modelInvocationInput?.type === "ROUTING_CLASSIFIER" ||
      // Additional check for any field that might contain type="ROUTING_CLASSIFIER" 
      traceData?.type === "ROUTING_CLASSIFIER") {
    console.log('EXACT MATCH: modelInvocationInput.type === ROUTING_CLASSIFIER - returning Supervisor type');
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // --- OTHER AGENT TYPES CHECKS ---
  // These remain unchanged but with lower priority
  if (traceData?.agentName === 'ProductRecommendation') {
    console.log('EXACT MATCH: agentName === ProductRecommendation');
    return AGENT_TYPES.PRODUCT_RECOMMENDATION;
  }
  
  if (traceData?.agentName === 'Troubleshoot') {
    console.log('EXACT MATCH: agentName === Troubleshoot');
    return AGENT_TYPES.TROUBLESHOOT;
  }
  
  if (traceData?.agentName === 'Personalization') {
    console.log('EXACT MATCH: agentName === Personalization');
    return AGENT_TYPES.PERSONALIZATION;
  }
  
  if (traceData?.agentName === 'OrderManagement') {
    console.log('EXACT MATCH: agentName === OrderManagement');
    return AGENT_TYPES.ORDER_MANAGEMENT;
  }

  // --- FALLBACK 1: Check for agentName fuzzy matches if exact match fails ---
  if (traceData?.agentName) {
    const normalizedAgentName = traceData.agentName.toLowerCase();
    
    // Routing classifier detection - redirect to Supervisor
    if (normalizedAgentName.includes('routing') || 
        normalizedAgentName.includes('classifier') ||
        normalizedAgentName === 'routing_classifier' || 
        traceData.agentName === 'ROUTING_CLASSIFIER') {
      console.log(`Agent name match for routing_classifier: ${traceData.agentName} - returning Supervisor type`);
      return AGENT_TYPES.SUPERVISOR;
    }

    // Supervisor detection - check agentName ONLY
    if (normalizedAgentName.includes('supervisor') || 
        normalizedAgentName.includes('main') ||
        normalizedAgentName.includes('orchestrator') ||
        traceData.agentName === 'Supervisor') {
      console.log(`Agent name match for Supervisor: ${traceData.agentName}`);
      return AGENT_TYPES.SUPERVISOR;
    }
    
    // Product recommendation detection - check agentName ONLY
    if (normalizedAgentName.includes('product') ||
        normalizedAgentName.includes('recommendation') ||
        normalizedAgentName.includes('recommend')) {
      console.log(`Agent name match for ProductRecommendation: ${traceData.agentName}`);
      return AGENT_TYPES.PRODUCT_RECOMMENDATION;
    }
    
    // Troubleshoot detection - check agentName ONLY
    if (normalizedAgentName.includes('trouble') ||
        normalizedAgentName.includes('support')) {
      console.log(`Agent name match for Troubleshoot: ${traceData.agentName}`);
      return AGENT_TYPES.TROUBLESHOOT;
    }
    
    // Personalization detection - check agentName ONLY
    if (normalizedAgentName.includes('personal') ||
        normalizedAgentName.includes('preference')) {
      console.log(`Agent name match for Personalization: ${traceData.agentName}`);
      return AGENT_TYPES.PERSONALIZATION;
    }
    
    // Order management detection - check agentName ONLY
    if (normalizedAgentName.includes('order') ||
        normalizedAgentName.includes('management') ||
        normalizedAgentName.includes('shipping')) {
      console.log(`Agent name match for OrderManagement: ${traceData.agentName}`);
      return AGENT_TYPES.ORDER_MANAGEMENT;
    }
  }
  
  // --- SECOND PRIORITY: Check trace structure patterns for legacy trace formats ---
  // This is important for traces that don't have agentName field
  
  // Check for routing classifier by structure - redirect to Supervisor
  if (traceData?.trace?.routingClassifierTrace) {
    console.log('Detected routing classifier by trace structure (legacy format) - returning Supervisor type');
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // Additional structural checks for routing classifier - redirect to Supervisor
  if (traceData?.trace?.trace_type === 'routing_classifier' || 
      traceData?.trace_type === 'routing_classifier') {
    console.log('Detected routing classifier by trace_type field (legacy format) - returning Supervisor type');
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // Structural checks for supervisor
  if (traceData?.trace?.orchestrationTrace?.supervisorMetadata ||
      traceData?.supervisorMetadata ||
      traceData?.trace?.supervisorTrace) {
    console.log('Detected supervisor by metadata/trace fields (legacy format)');
    return AGENT_TYPES.SUPERVISOR;
  }

  // --- THIRD PRIORITY: Check pattern matching on agent names ---
  // Check agent name fields (this is most reliable)
  const getAgentTypeByName = (name: string | undefined | null): string | null => {
    if (!name) return null;
    
    const normalizedName = name.toLowerCase();
    
    // Check each agent pattern
    for (const [agentType, patterns] of Object.entries(AGENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (normalizedName.includes(pattern)) {
          console.log(`Matched ${agentType} by name pattern: ${pattern} in ${normalizedName}`);
          return AGENT_TYPES[agentType as keyof typeof AGENT_TYPES];
        }
      }
    }
    
    return null;
  };
  
  // Check agent name only - removed collaboratorName check per user request
  const agentNameType = getAgentTypeByName(traceData.agentName);
  if (agentNameType) return agentNameType;
  
  // --- FOURTH PRIORITY: Check routing classifier by ID patterns - redirect to Supervisor ---
  if (isRoutingClassifierAgent(traceData.agentId, traceData.agentAliasId)) {
    console.log('Identified routing classifier by ID match - returning Supervisor type');
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // --- FIFTH PRIORITY: Use pattern matching on agent IDs ---
  if (traceData?.agentId) {
    // Use pattern matching instead of hardcoded IDs
    const agentType = getAgentTypeFromName(traceData.agentId);
    
    if (agentType) {
      console.log(`Identified agent by name pattern matching: ${traceData.agentId} -> ${agentType}`);
      return agentType;
    }
  }

  // --- SIXTH PRIORITY: Check orchestration trace patterns ---
  if (traceData?.trace?.orchestrationTrace) {
    const trace = traceData.trace.orchestrationTrace;
    
    // Supervisor pattern detection (highest priority in orchestration traces)
    if (trace.rationale || trace.observation?.finalResponse) {
      console.log('Identified supervisor by rationale/final response pattern');
      return AGENT_TYPES.SUPERVISOR;
    }
    
    // Check for agent collaborator patterns
    if (trace.invocationInput?.agentCollaboratorInvocationInput) {
      const agentName = trace.invocationInput.agentCollaboratorInvocationInput.agentCollaboratorName;
      if (agentName) {
        const collaboratorType = getAgentTypeByName(agentName);
        if (collaboratorType) {
          console.log(`Identified collaborator type from orchestration: ${collaboratorType}`);
          return collaboratorType;
        }
      }
    }
    
    // Check for agent collaborator observation patterns
    if (trace.observation?.agentCollaboratorInvocationOutput) {
      const agentName = trace.observation.agentCollaboratorInvocationOutput.agentCollaboratorName;
      if (agentName) {
        const collaboratorType = getAgentTypeByName(agentName);
        if (collaboratorType) {
          console.log(`Identified collaborator type from output: ${collaboratorType}`);
          return collaboratorType;
        }
      }
    }
    
    // Check for model input text patterns
    if (trace.modelInvocationInput?.text) {
      const text = trace.modelInvocationInput.text.toLowerCase();
      
      if (text.includes('supervisor') || text.includes('orchestrat')) {
        console.log('Identified supervisor by model input text');
        return AGENT_TYPES.SUPERVISOR;
      }
      
      if (text.includes('routing') || text.includes('classifier') || text.includes('ROUTING_CLASSIFIER')) {
        console.log('Identified routing classifier by model input text - returning Supervisor type');
        return AGENT_TYPES.SUPERVISOR;
      }
    }
  }

  // Knowledge base pattern detection - identify the agent using it
  if (traceData?.trace?.orchestrationTrace?.observation?.type === 'KNOWLEDGE_BASE' ||
      traceData?.trace?.orchestrationTrace?.observation?.knowledgeBaseLookupOutput ||
      traceData?.trace?.orchestrationTrace?.invocationInput?.knowledgeBaseLookupInput) {
    
    const trace = traceData.trace.orchestrationTrace;
    
    // Try to determine which agent is using the KB
    if (trace?.invocationInput?.knowledgeBaseLookupInput?.text) {
      const query = trace.invocationInput.knowledgeBaseLookupInput.text.toLowerCase();
      
      // Check query text against agent patterns
      for (const [agentType, patterns] of Object.entries(AGENT_PATTERNS)) {
        for (const pattern of patterns) {
          if (query.includes(pattern)) {
            console.log(`Matched KB query to ${agentType} by pattern: ${pattern}`);
            return AGENT_TYPES[agentType as keyof typeof AGENT_TYPES];
          }
        }
      }
    }
    
    // Return the original agent type for KB operations
    return traceData.collaboratorName || AGENT_TYPES.SUPERVISOR;
  }
  
  // Check for specific content patterns in model invocations
  if (traceData?.trace?.orchestrationTrace?.modelInvocationOutput?.rawResponse?.content) {
    const content = traceData.trace.orchestrationTrace.modelInvocationOutput.rawResponse.content;
    if (typeof content === 'string') {
      const normalizedContent = content.toLowerCase();
      
      // Check content against agent patterns
      for (const [agentType, patterns] of Object.entries(AGENT_PATTERNS)) {
        for (const pattern of patterns) {
          if (normalizedContent.includes(pattern)) {
            console.log(`Matched content to ${agentType} by pattern: ${pattern}`);
            return AGENT_TYPES[agentType as keyof typeof AGENT_TYPES];
          }
        }
      }
    }
  }
  
  // Fallback to Supervisor for unknown traces that look like coordination
  if (traceData?.trace?.orchestrationTrace?.modelInvocationInput ||
      traceData?.trace?.orchestrationTrace?.modelInvocationOutput) {
    console.log('Identified coordination pattern - treating as Supervisor');
    return AGENT_TYPES.SUPERVISOR;
  }
  
  // Final fallback - assume it's the Supervisor
  console.log('%c🔍 [Supervisor] No specific agent type identified - defaulting to Supervisor', 'color: #9C27B0; font-weight: bold;');
  
  // Enhance trace data with explicit supervisor identification
  if (traceData) {
    // If no collaboratorName exists yet, add it
    if (!traceData.collaboratorName) {
      traceData.collaboratorName = 'Supervisor';
    }
    
    // If no agentId exists that could help identify this trace later, add one
    if (!traceData.agentId) {
      traceData.agentId = 'SUPERVISOR_MAIN';
    }
  }
  
  // Close the console group before returning
  console.groupEnd();
  
  return AGENT_TYPES.SUPERVISOR;
}

// Helper function to determine the specific trace type for step titles
function getStepTitle(traceContent: any): string {
  if (!traceContent) return "";

  // First check for routing classifier specific traces
  if (traceContent.trace?.routingClassifierTrace) {
    // Set parent task title for routing classifier traces
    if (traceContent._isRoutingClassifierParent) {
      return "Routing Classifier";
    }
    // Check for various components in order of specificity
    if (traceContent.trace.routingClassifierTrace.modelInvocationInput) {
      return "Classifying Intent";
    }
    if (traceContent.trace.routingClassifierTrace.modelInvocationOutput) {
      return "Routing Classifier Decision";
    }
    if (traceContent.trace.routingClassifierTrace.invocationInput?.agentCollaboratorInvocationInput) {
      const agentName = traceContent.trace.routingClassifierTrace.invocationInput
        .agentCollaboratorInvocationInput?.agentCollaboratorName || 'Agent';
      return `Agent Invocation - ${agentName}`;
    }
    if (traceContent.trace.routingClassifierTrace.observation?.finalResponse) {
      return "Final Response";
    }
    return "Routing Classification";
  }

  // Check orchestration traces
  if (traceContent.trace?.orchestrationTrace) {
    // Model invocation
    if (traceContent.trace.orchestrationTrace.modelInvocationInput) {
      return "Invoking Model";
    }
    if (traceContent.trace.orchestrationTrace.modelInvocationOutput) {
      return "Invoking Model";
    }
    
    // Agent collaborator invocation
    if (traceContent.trace.orchestrationTrace.invocationInput?.agentCollaboratorInvocationInput) {
      const agentName = traceContent.trace.orchestrationTrace.invocationInput
        .agentCollaboratorInvocationInput?.agentCollaboratorName || 'Agent';
      return `Agent Invocation - ${agentName}`;
    }
    
    // Knowledge base lookups
    if (traceContent.trace.orchestrationTrace.invocationInput?.knowledgeBaseLookupInput) {
      // Use more descriptive name for knowledge base query
      return "Knowledge Base Tool";
    }
    if (traceContent.trace.orchestrationTrace.observation?.knowledgeBaseLookupOutput) {
      // Use more descriptive name for knowledge base results
      return "Knowledge Base Results";
    }
    
    // Action groups - combine tool and result into a unified "Action Group Tool" step
    if (traceContent.trace.orchestrationTrace.invocationInput?.actionGroupInvocationInput) {
      const actionGroup = traceContent.trace.orchestrationTrace.invocationInput.actionGroupInvocationInput;
      
      // Extract action group name for consistent pairing with outputs but don't display in title
      if (actionGroup.actionGroupName || actionGroup.name) {
        // Store the action group name as a property on the trace content for matching with outputs
        traceContent._actionGroupName = actionGroup.actionGroupName || actionGroup.name;
      }
      
      return "Action Group Tool";
    }
    if (traceContent.trace.orchestrationTrace.observation?.actionGroupInvocationOutput) {
      // Use Action Group Input instead of plain Action Group for better subtask matching
      return "Action Group Output"; // Use a clearer name for outputs
    }
    
    // Final response and rationale
    if (traceContent.trace.orchestrationTrace.observation?.finalResponse) {
      return "Final Response";
    }
    if (traceContent.trace.orchestrationTrace.rationale) {
      return "Rationale";
    }
    
    // Agent output
    if (traceContent.trace.orchestrationTrace.observation?.agentCollaboratorInvocationOutput) {
      return "Observation";
    }
  }

  // Default if no specific type found
  return "Processing";
}

// Helper function to determine model invocation operation type
function getModelInvocationOperationType(traceContent: any): string | null {
  if (!traceContent || !traceContent.trace?.orchestrationTrace) return null;
  
  if (traceContent.trace.orchestrationTrace.modelInvocationInput) {
    return "Model Input";  // Input operation
  }
  if (traceContent.trace.orchestrationTrace.modelInvocationOutput) {
    return "Model Output";  // Output operation
  }
  
  // Check for any model invocation pattern to support nesting
  if (traceContent.trace?.orchestrationTrace?.modelInvocationInput || 
      traceContent.trace?.orchestrationTrace?.modelInvocationOutput) {
    return "Model Operation";  // General operation for grouping
  }
  
  return null;
}

// Helper function to determine the knowledge base operation type
function getKnowledgeBaseOperationType(traceContent: any): string | null {
  if (!traceContent || !traceContent.trace?.orchestrationTrace) return null;
  
  if (traceContent.trace.orchestrationTrace.invocationInput?.knowledgeBaseLookupInput) {
    return "Knowledge Base Query";  // Consistently use "Query" instead of "Input"
  }
  if (traceContent.trace.orchestrationTrace.observation?.knowledgeBaseLookupOutput) {
    return "Knowledge Base Results";  // Consistently use "Results" instead of "Output"
  }
  
  return null;
}

// Helper function to determine the action group operation type
function getActionGroupOperationType(traceContent: any): string | null {
  if (!traceContent || !traceContent.trace?.orchestrationTrace) return null;
  
  if (traceContent.trace.orchestrationTrace.invocationInput?.actionGroupInvocationInput) {
    return "Action Group Input";
  }
  if (traceContent.trace.orchestrationTrace.observation?.actionGroupInvocationOutput) {
    return "Action Group Output";
  }
  
  return null;
}

// Format ResultSet data from action group output into a readable table format
function formatResultSetData(result: any): string {
  if (!result || !result.ResultSet || !result.ResultSet.Rows || !Array.isArray(result.ResultSet.Rows)) {
    return JSON.stringify(result, null, 2);
  }
  
  const rows = result.ResultSet.Rows;
  if (rows.length < 2) {
    return JSON.stringify(result, null, 2);
  }
  
  try {
    // Extract headers from first row
    const headers = rows[0].Data.map((item: any) => item.VarCharValue);
    
    // Create a markdown table
    let table = "### Query Result\n\n";
    
    // Add header row
    table += "| " + headers.join(" | ") + " |\n";
    
    // Add separator row
    table += "| " + headers.map(() => "---").join(" | ") + " |\n";
    
    // Add data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const values = row.Data.map((item: any) => item.VarCharValue || "");
      table += "| " + values.join(" | ") + " |\n";
    }
    
    // Add metadata information
    if (result.UpdateCount !== undefined) {
      table += "\n**Update Count:** " + result.UpdateCount;
    }
    
    if (result.ResultSet.ResultSetMetadata?.ColumnInfo) {
      const columnInfo = result.ResultSet.ResultSetMetadata.ColumnInfo;
      table += "\n\n### Column Metadata\n\n";
      columnInfo.forEach((col: any) => {
        table += `- **${col.Name}** (${col.Type})\n`;
      });
    }
    
    return table;
  } catch (e) {
    console.error("Error formatting ResultSet data:", e);
    return JSON.stringify(result, null, 2);
  }
}

// Handle a trace message and update trace state
export function handleTraceMessage(
  message: { type: string; content: any },
  state: TraceState,
  callback: (state: TraceState) => TraceState
): void {
  if (message.type === 'trace' && message.content) {
    // Process the trace data
    const newState = processTraceData(
      state,
      message.content.sessionId || message.content.agentId || String(Date.now()),
      message.content,
      message.content.text || 'Processing...',
      Date.now()
    );
    
    // Apply the callback with the new state
    callback(newState);
  }
}

  // Process trace data to extract content for display
function extractTraceContent(traceContent: any): { 
  displayContent: string | null, 
  fullJsonContent: string | null 
} {
  if (!traceContent) {
    return { displayContent: null, fullJsonContent: null };
  }
  
  let displayContent: string | null = null;
  let fullJsonContent: string | null = JSON.stringify(traceContent, null, 2);
  
  // Handle routing classifier traces
  if (traceContent.trace?.routingClassifierTrace) {
    // Model invocation input
    if (traceContent.trace.routingClassifierTrace.modelInvocationInput?.text) {
      displayContent = traceContent.trace.routingClassifierTrace.modelInvocationInput.text;
    }
    // Model invocation output
    else if (traceContent.trace.routingClassifierTrace.modelInvocationOutput?.rawResponse?.content) {
      displayContent = typeof traceContent.trace.routingClassifierTrace.modelInvocationOutput.rawResponse.content === 'string' 
        ? traceContent.trace.routingClassifierTrace.modelInvocationOutput.rawResponse.content
        : JSON.stringify(traceContent.trace.routingClassifierTrace.modelInvocationOutput.rawResponse.content, null, 2);
    }
    // Agent collaborator invocation
    else if (traceContent.trace.routingClassifierTrace.invocationInput?.agentCollaboratorInvocationInput?.input?.text) {
      displayContent = traceContent.trace.routingClassifierTrace.invocationInput.agentCollaboratorInvocationInput.input.text;
    }
    // Agent collaborator output
    else if (traceContent.trace.routingClassifierTrace.observation?.agentCollaboratorInvocationOutput?.output?.text) {
      displayContent = traceContent.trace.routingClassifierTrace.observation.agentCollaboratorInvocationOutput.output.text;
    }
    // Final response
    else if (traceContent.trace.routingClassifierTrace.observation?.finalResponse?.text) {
      displayContent = traceContent.trace.routingClassifierTrace.observation.finalResponse.text;
    }
  }
  
  // Handle orchestration traces
  else if (traceContent.trace?.orchestrationTrace) {
    // We're no longer setting displayContent for model invocation input here
    // Instead, we'll handle it as a subtask in processTraceData
    if (traceContent.trace.orchestrationTrace.modelInvocationOutput?.rawResponse?.content) {
      displayContent = typeof traceContent.trace.orchestrationTrace.modelInvocationOutput.rawResponse.content === 'string'
        ? traceContent.trace.orchestrationTrace.modelInvocationOutput.rawResponse.content
        : JSON.stringify(traceContent.trace.orchestrationTrace.modelInvocationOutput.rawResponse.content, null, 2);
    }
    // Knowledge base input
    else if (traceContent.trace.orchestrationTrace.invocationInput?.knowledgeBaseLookupInput) {
      console.log('Found Knowledge Base Input trace');
      const kbInput = traceContent.trace.orchestrationTrace.invocationInput.knowledgeBaseLookupInput;
      displayContent = kbInput.text || JSON.stringify(kbInput, null, 2);
    }
    // Knowledge base output
    else if (traceContent.trace.orchestrationTrace.observation?.knowledgeBaseLookupOutput) {
      console.log('[Knowledge Base] Found Knowledge Base Output trace');
      const kbOutput = traceContent.trace.orchestrationTrace.observation.knowledgeBaseLookupOutput;
      
      if (kbOutput.retrievedReferences && kbOutput.retrievedReferences.length > 0) {
        // Format references if available
        displayContent = "### KNOWLEDGE BASE RESPONSE ###\n\n" + kbOutput.retrievedReferences
          .map((ref: any, index: number) => {
            const source = ref.source ? `Source: ${ref.source}\n` : '';
            const text = ref.content && ref.content.text ? ref.content.text : 'No content available';
            return `Reference ${index + 1}:\n${source}${text}`;
          })
          .join('\n\n---\n\n');
      } else {
        // If no references, show the whole output
        displayContent = "### KNOWLEDGE BASE RESPONSE ###\n\n" + JSON.stringify(kbOutput, null, 2);
      }

      // Save the raw KB response JSON for debugging
      console.log('[Knowledge Base] Raw KB response:', kbOutput);
    }
    // Action group input
    else if (traceContent.trace.orchestrationTrace.invocationInput?.actionGroupInvocationInput) {
      console.log('Found Action Group Input trace');
      const actionInput = traceContent.trace.orchestrationTrace.invocationInput.actionGroupInvocationInput;
      
      // Try to extract meaningful content from action group input
      let actionContent = '';
      if (actionInput.requestBody?.content?.['application/json']) {
        const jsonContent = actionInput.requestBody.content['application/json'];
        if (Array.isArray(jsonContent) && jsonContent.length > 0 && jsonContent[0].value) {
          actionContent = JSON.stringify(jsonContent[0].value, null, 2);
        }
      }
      
      displayContent = actionContent || JSON.stringify(actionInput, null, 2);
    }
    // Action group output
    else if (traceContent.trace.orchestrationTrace.observation?.actionGroupInvocationOutput) {
      console.log('Found Action Group Output trace');
      const actionOutput = traceContent.trace.orchestrationTrace.observation.actionGroupInvocationOutput;
      
      if (actionOutput.text) {
        try {
          // Try to parse and prettify any JSON in the text
          const parsedOutput = JSON.parse(actionOutput.text as string);

          // Check for the specific ResultSet structure
          if (parsedOutput.result && parsedOutput.result.ResultSet && 
              parsedOutput.result.ResultSet.Rows && Array.isArray(parsedOutput.result.ResultSet.Rows)) {
            console.log('Detected ResultSet structure in action group output');
            displayContent = formatResultSetData(parsedOutput.result);
          } else {
            // Standard JSON formatting
            displayContent = JSON.stringify(parsedOutput, null, 2);
          }
        } catch (e) {
          // Not JSON, use as is
          displayContent = actionOutput.text as string;
        }
      } else {
        // Fall back to full output
        displayContent = JSON.stringify(actionOutput, null, 2);
      }
    }
    // Rationale
    else if (traceContent.trace.orchestrationTrace.rationale?.text) {
      displayContent = traceContent.trace.orchestrationTrace.rationale.text;
    }
    // Final response
    else if (traceContent.trace.orchestrationTrace.observation?.finalResponse?.text) {
      displayContent = traceContent.trace.orchestrationTrace.observation.finalResponse.text;
    }
    // Agent collaborator invocation
    else if (traceContent.trace.orchestrationTrace.invocationInput?.agentCollaboratorInvocationInput?.input?.text) {
      displayContent = traceContent.trace.orchestrationTrace.invocationInput.agentCollaboratorInvocationInput.input.text;
    }
    // Agent collaborator output
    else if (traceContent.trace.orchestrationTrace.observation?.agentCollaboratorInvocationOutput?.output?.text) {
      displayContent = traceContent.trace.orchestrationTrace.observation.agentCollaboratorInvocationOutput.output.text;
    }
  }
  
  return { displayContent, fullJsonContent };
}

// Helper to determine if a trace should increment the step counter
function shouldIncrementStepCounter(stepTitle: string, existingTraceGroup: TraceGroup | null): boolean {
  // Get previous step title if available
  const previousTitle = existingTraceGroup?.tasks?.length 
    ? existingTraceGroup.tasks[existingTraceGroup.tasks.length - 1].title 
    : null;
  
  // Log step title check for debugging step numbering
  console.log(`Checking if step should increment: "${stepTitle}"`);
  
  // Group these related pairs together as single steps
  if (previousTitle) {
    // If previous step was Knowledge Base Query, don't increment for Knowledge Base Results
    if (previousTitle.includes("Knowledge Base Query") && stepTitle === "Knowledge Base Results") {
      return false;
    }
    
    // ActionGroupTool should always get its own step number, don't use this pairing logic for it
    
    // ALWAYS increment for Invoking Model steps to ensure each gets its own step number
    if (stepTitle === "Invoking Model") {
      return true;
    }
  }
  
  // These specific titles should always increment the step counter
  const shouldIncrement = 
    stepTitle === "Invoking Model" || 
    stepTitle.includes("Agent Invocation") ||  // IMPORTANT: Add Agent Invocation steps - this fixes the step numbering
    stepTitle === "Knowledge Base Tool" ||
    stepTitle === "Action Group Tool" ||
    stepTitle.includes("Action Group Tool:");
    
  console.log(`Step "${stepTitle}" should increment: ${shouldIncrement}`);
  return shouldIncrement;
}

// Helper function to find a model invocation parent task
function findModelInvocationParentTask(tasks: Task[], agentId: string, forOutput: boolean = false): number {
  // Look for a suitable "Invoking Model" parent task, starting from the most recent
  for (let i = tasks.length - 1; i >= 0; i--) {
    const task = tasks[i];
    if (task.title.includes("Invoking Model") && 
        (task._agentId === agentId || !task._agentId)) {
      
      if (forOutput) {
        // When looking for a parent for Model Output, find a task that already has Model Input
        // but doesn't have Model Output yet
        if (task.subTasks && 
            task.subTasks.some(st => st.title.includes("Model Input")) &&
            !task.subTasks.some(st => st.title.includes("Model Output"))) {
          console.log(`Found existing Model Invocation parent with Input but no Output yet at index ${i}`);
          return i;
        }
      } else {
        // For Model Input or general case
        // If the task has no subtasks at all, it's a good candidate
        if (!task.subTasks || task.subTasks.length === 0) {
          return i;
        }
        
        // Or if it has subtasks but none are Model Input/Output yet
        if (task.subTasks && 
            !task.subTasks.some(st => 
              st.title.includes("Model Input") || st.title.includes("Model Output"))) {
          return i;
        }
      }
    }
  }
  
  // No suitable parent found
  return -1;
}

// Classify a trace item to determine if it should be a subtask
function isSubtaskTrace(traceType: string, stepTitle: string): boolean {
  // These are parent task titles - they should be top-level steps
  if (stepTitle === "Knowledge Base" || 
      stepTitle.includes("Knowledge Base (") ||
      stepTitle === "Knowledge Base Tool" || 
      stepTitle.includes("Knowledge Base Tool (") ||
      stepTitle.includes("Action Group Tool") ||
      stepTitle === "Routing Classifier" ||  // Make "Routing Classifier" a main step
      (stepTitle !== "Classifying Intent" && 
       stepTitle !== "Routing Classifier Decision" &&
       stepTitle !== "Routing Classification" &&
       shouldIncrementStepCounter(stepTitle, null))) {
    // Special case for "Invoking Model" - first occurrence is a main step,
    // subsequent occurrences should be subtasks handled in processTraceData
    if (stepTitle === "Invoking Model") {
      console.log('Found Invoking Model. Will be treated as main step or subtask based on context');
      // Let the context in processTraceData determine whether this is a subtask
      return false;
    }
    return false; // These are main steps
  }
  
  // Specific operation types that should always be treated as subtasks
  if (stepTitle === "Knowledge Base Input" || 
      stepTitle === "Knowledge Base Output" ||
      stepTitle === "Action Group Input" ||
      stepTitle === "Action Group Output" ||
      stepTitle === "Action Group" || // Plain "Action Group" is always a subtask
      stepTitle === "Model Input" ||  // Model invocation subtasks - ALWAYS subtasks
      stepTitle === "Model Output" || // Model invocation subtasks - ALWAYS subtasks
      stepTitle === "Classifying Intent" ||  // Make routing classifier traces subtasks
      stepTitle === "Routing Classifier Decision" ||  // Make routing classifier traces subtasks
      stepTitle === "Routing Classification" ||  // Make routing classifier traces subtasks
      stepTitle.toLowerCase().includes("knowledge base query") ||
      stepTitle.toLowerCase().includes("knowledge base results") ||
      stepTitle.toLowerCase().includes("action group input") ||
      stepTitle.toLowerCase().includes("action group output") ||
      stepTitle.toLowerCase().includes("action group result")) {
    console.log(`Identified subtask: ${stepTitle}`);
    return true;
  }
  
  return false;
}

// Helper to determine if a trace is a "special" type outside the normal step numbering
function isSpecialTraceType(stepTitle: string): boolean {
  return stepTitle === 'Final Response' || 
         stepTitle === 'Observation' || 
         stepTitle === 'Rationale';
}

// Helper function to add a subtask to a parent task
export function addSubTask(
  parentTask: Task,
  subTaskTitle: string,
  subTaskContent: string | object,
  subTaskJson: string | null,
  currentTime: number
): void {
  if (!parentTask.subTasks) {
    parentTask.subTasks = [];
  }
  
  // Special handling for content - make sure it's visible as a property
  if (!parentTask.content) {
    // If the parent task doesn't have content but the subtask does,
    // add a placeholder to ensure the dropdown displays properly
    parentTask.content = "This step contains multiple substeps...";
  }
  
  // For model invocation parent tasks, always use a specific content
  if (parentTask.title.includes("Invoking Model")) {
    parentTask.content = "Model invocation details in subtasks below";
  }
  
  // Check if we already have a subtask with a similar title (ignoring timing info)
  const normalizedTitle = subTaskTitle.replace(/\(\d+\.?\d* seconds\)/, '').trim();
  const existingSubtaskIndex = parentTask.subTasks.findIndex(subtask => 
    subtask.title.includes(normalizedTitle)
  );
  
  // Calculate elapsed time from parent task start
  const subTimeDifference = (
    (currentTime - parentTask.timestamp) /
    1000
  ).toFixed(2);

  const formattedSubTaskTime = parseFloat(subTimeDifference).toFixed(2);
  
  if (existingSubtaskIndex >= 0) {
    // Update existing subtask with new timing
    const existingSubtask = parentTask.subTasks[existingSubtaskIndex];
    // Calculate time since last update for this subtask
    const timeSinceUpdate = ((currentTime - existingSubtask.timestamp) / 1000).toFixed(2);
    
    const stepMatch = existingSubtask.title.match(/Step (\d+\.\d+)/);
    if (stepMatch) {
      // Update the subtask with new content and timestamp
      parentTask.subTasks[existingSubtaskIndex] = {
        ...existingSubtask,
        content: subTaskContent,
        fullJson: subTaskJson,
        timestamp: currentTime,
        title: `${stepMatch[0]} (${formattedSubTaskTime}s, +${timeSinceUpdate}s): ${normalizedTitle}`
      };
    } else {
      // No step number in title, just update with new timing
      parentTask.subTasks[existingSubtaskIndex] = {
        ...existingSubtask,
        content: subTaskContent,
        fullJson: subTaskJson,
        timestamp: currentTime,
        title: `${normalizedTitle} (${formattedSubTaskTime}s, +${timeSinceUpdate}s)`
      };
    }
  } else {
    // Add new subtask
    const newSubTask: SubTask = {
      title: `${normalizedTitle} (${formattedSubTaskTime}s)`,
      content: subTaskContent,
      fullJson: subTaskJson,
      timestamp: currentTime
    };
    parentTask.subTasks.push(newSubTask);
  }
}

  // Process trace data into organized TraceGroup records
export function processTraceData(
  state: TraceState,
  traceId: string,
  rawTraceData: any,
  message: string,
  currentTime: number = Date.now()
): TraceState {
  console.log('Processing trace data...', { traceId, trace: rawTraceData });
  
  if (!traceId || !rawTraceData) {
    console.error('Invalid trace data:', { traceId, trace: rawTraceData });
    return state;
  }
  
  // Make a fresh copy of the state to modify
  const newState = { ...state };
  
  // Extract agent details and set trace type
  const agentType = getAgentTypeFromTrace(rawTraceData);
  const traceType = rawTraceData.trace?.routingClassifierTrace ? 'routingClassifierTrace' : 'orchestrationTrace';
  
  // Create a base model for the agent identifier - we'll need this to identify
  // and group related traces
  let agentId = rawTraceData.agentId || rawTraceData.collaboratorName || agentType;
  
  // Generate a group ID that uniquely identifies this conversation thread
  let groupId = rawTraceData.sessionId || traceId;
  
  // First look for traceId in existing traces to see if this is an update
  const existingTraceGroup = newState.messages.find(
    (msg): msg is TraceGroup => 
      msg.type === 'trace-group' && msg.id === groupId
  );
  
  // Extract specific trace step details
  const stepTitle = getStepTitle(rawTraceData);
  
  // Check if this is a routing classifier trace that requires a parent
  // We need to identify both explicit routing classifier traces and those with specific step titles
  const isRoutingClassifierTrace = rawTraceData.trace?.routingClassifierTrace && 
                                  (rawTraceData.trace.routingClassifierTrace.modelInvocationInput ||
                                   rawTraceData.trace.routingClassifierTrace.modelInvocationOutput ||
                                   stepTitle === "Classifying Intent" ||
                                   stepTitle === "Routing Classifier Decision");
  const knowledgeBaseType = getKnowledgeBaseOperationType(rawTraceData);
  const actionGroupType = getActionGroupOperationType(rawTraceData);
  const modelInvocationType = getModelInvocationOperationType(rawTraceData);
  
  // Extract content for display, but also capture model input content separately
  // if it exists, so we can add it as a subtask
  const { displayContent, fullJsonContent } = extractTraceContent(rawTraceData);
  
  // Extract model input content if it exists
  let modelInputContent: string | null = null;
  if (rawTraceData.trace?.orchestrationTrace?.modelInvocationInput?.text) {
    modelInputContent = rawTraceData.trace.orchestrationTrace.modelInvocationInput.text;
  }
  
  console.log('Trace analysis:', {
    agentType,
    traceType,
    groupId,
    isExisting: !!existingTraceGroup,
    stepTitle,
    knowledgeBaseType,
    actionGroupType,
    modelInvocationType,
    hasContent: !!displayContent
  });

  // Calculate time since trace start (for existing trace group)
  let formattedTimeDifference = "0.00";
  if (existingTraceGroup) {
    const timeDifference = ((currentTime - existingTraceGroup.startTime) / 1000);
    formattedTimeDifference = parseFloat(timeDifference.toString()).toFixed(2);
  }
  
  // Determine step number and check if we have a subtask type
  let stepNumber = 1;
  let parentTaskIndex = -1;
  let subtaskType = null;
  
  // Check if this is a routing classifier trace that should be nested
  if (isRoutingClassifierTrace) {
    subtaskType = getStepTitle(rawTraceData); // Use the specific type (e.g., "Classifying Intent")
  }
  
  if (knowledgeBaseType) {
    subtaskType = knowledgeBaseType;
  } else if (actionGroupType) {
    subtaskType = actionGroupType;
  } else if (modelInvocationType) {
    subtaskType = modelInvocationType;
  }
  
  // Process cases for existing trace groups
  if (existingTraceGroup) {
    // Update the last update time for the trace group
    existingTraceGroup.lastUpdateTime = currentTime;
    
    // Get previous task's timestamp to calculate individual step time (if available)
    let previousTaskTime = existingTraceGroup.startTime;
    if (existingTraceGroup.tasks && existingTraceGroup.tasks.length > 0) {
      previousTaskTime = existingTraceGroup.tasks[existingTraceGroup.tasks.length - 1].timestamp;
    }
    
    // Calculate time since last step (individual step time)
    const individualStepTime = ((currentTime - previousTaskTime) / 1000).toFixed(2);
    
    // Process steps differently based on whether we should increment or not
    if (!existingTraceGroup.tasks || existingTraceGroup.tasks.length === 0) {
      // First step in trace group
      stepNumber = 1;
    } else {
      // Find the highest step number used so far to ensure continuity
      const taskNumbers = existingTraceGroup.tasks
        .filter(task => task.stepNumber > 0)
        .map(task => task.stepNumber);
      
      // Default to 1 if no numbered tasks exist yet
      const highestStepNumber = taskNumbers.length > 0 ? Math.max(...taskNumbers) : 0;
      
      // Special handling for routing classifier traces
      if (isRoutingClassifierTrace) {
        // Look for an existing "Routing Classifier" parent task
        const routingClassifierParentIndex = existingTraceGroup.tasks.findIndex(task => 
          task.title.includes("Routing Classifier") && !task.title.includes("Decision")
        );
        
        if (routingClassifierParentIndex >= 0) {
          // Found a routing classifier parent, use it
          parentTaskIndex = routingClassifierParentIndex;
          console.log(`Found existing Routing Classifier parent at index ${parentTaskIndex}`);
          // Use the same step number as the parent
          stepNumber = existingTraceGroup.tasks[parentTaskIndex].stepNumber;
        } else {
          // No routing classifier parent found, need to create one
          // Will be handled below
          console.log('No Routing Classifier parent found, will create one');
        }
      }
      
      // Special handling for "Invoking Model" to ensure proper sequence numbering
      if (stepTitle === "Invoking Model") {
        // Create or extract model invocation ID
        let modelInvocationId;
        
        // Check if this trace has an input or output
        const hasInput = !!rawTraceData.trace?.orchestrationTrace?.modelInvocationInput;
        const hasOutput = !!rawTraceData.trace?.orchestrationTrace?.modelInvocationOutput;
        
        // First, check if this is an output trace that needs to be paired with an existing input
        if (hasOutput && !hasInput) {
          console.log('This is a Model Output trace - looking for matching Model Input parent');
          
          // Find a suitable parent task that already has a Model Input subtask but no Output yet
          const existingParentIndex = findModelInvocationParentTask(existingTraceGroup.tasks, agentId, true);
          
          if (existingParentIndex >= 0) {
            // Found a suitable parent, use its step number and add output as a subtask
            parentTaskIndex = existingParentIndex;
            stepNumber = existingTraceGroup.tasks[existingParentIndex].stepNumber;
            subtaskType = "Model Output";
            
            console.log(`Found existing Model Invocation parent at index ${existingParentIndex}, using step ${stepNumber}`);
            
            // Extract the model invocation ID if present
            if (existingTraceGroup.tasks[existingParentIndex]._modelInvocationId) {
              modelInvocationId = existingTraceGroup.tasks[existingParentIndex]._modelInvocationId;
              rawTraceData._modelInvocationId = modelInvocationId;
              console.log(`Using existing model invocation ID: ${modelInvocationId}`);
            }
            
            // Continue to next section - we've set up parentTaskIndex, stepNumber and subtaskType
          } else {
            // No suitable existing input found, create a new task with output as subtask
            stepNumber = highestStepNumber + 1;
            console.log(`No suitable Model Input parent found, creating new Model Invocation step ${stepNumber}`);
            
            // Generate a model invocation ID
            const randomComponent = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            modelInvocationId = `model-${agentId}-${Date.now()}-${randomComponent}`;
            rawTraceData._modelInvocationId = modelInvocationId;
          }
        } else if (hasInput) {
          // This is an input trace - generate a unique model invocation ID
          const input = rawTraceData.trace?.orchestrationTrace?.modelInvocationInput;
          
          // Include a content hash for uniqueness if text is available
          let contentHash = '';
          if (input && input.text) {
            // Simple string hash function
            const hashText = (str: string): string => {
              let hash = 0;
              for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
              }
              // Get just the last few digits for brevity
              return Math.abs(hash).toString().slice(-6);
            };
            
            // Add a hash of the first 50 chars of input text for uniqueness
            contentHash = `-${hashText(input.text.slice(0, 50))}`;
          }
          
          // Generate a unique ID for this input
          const randomComponent = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          modelInvocationId = `model-${agentId}-${input?.timestamp || Date.now()}${contentHash}-${randomComponent}`;
          rawTraceData._modelInvocationId = modelInvocationId;
          
          console.log(`Generated model input ID: ${modelInvocationId}`);
          
          // Get a new step number for this input
          stepNumber = highestStepNumber + 1;
          console.log(`Creating new Model Invocation step ${stepNumber} for input with ID ${modelInvocationId}`);
        }
      } 
      // Check if we should increment step or add subtask for other types
      else if (isSpecialTraceType(stepTitle)) {
        // Special trace types like "Final Response" aren't numbered normally
        stepNumber = 0;
      } else if (isSubtaskTrace(agentType, stepTitle)) {
        // Check if this is a consecutive "Invoking Model" step that should be treated as a subtask
        const isConsecutiveModelInvocation = stepTitle === "Invoking Model" && 
          existingTraceGroup.tasks.some(task => task.title.includes("Invoking Model"));
            
        // Log the detection of consecutive model invocations
        if (isConsecutiveModelInvocation) {
          console.log('Detected consecutive Invoking Model - treating as subtask');
          subtaskType = subtaskType || "Model Operation";
        }
          
        // Look for a relevant parent task, which should be recently added
        for (let i = existingTraceGroup.tasks.length - 1; i >= 0; i--) {
          const task = existingTraceGroup.tasks[i];
          
          // For model invocation subtasks, we need special handling
          if (modelInvocationType || stepTitle === "Invoking Model") {
            // Always ensure model operations create a new task or go under an existing Invoking Model
            // Never nest them under other types like Action Group or Knowledge Base
            if (task.title.includes("Invoking Model")) {
              console.log(`Found Model Invocation parent task: ${task.title} for model operation`);
              parentTaskIndex = i;
              subtaskType = subtaskType || "Model Operation";
              break;
            } else {
              // If this is a model trace but there's no Invoking Model parent recently,
              // don't attach it as a subtask to anything else - force it to be a new task
              console.log(`No suitable Model Invocation parent found - creating new task for model operation`);
              parentTaskIndex = -1; // Force creation of a new task
              break;  // Exit the loop - we don't want to find any other parent
            }
          }
          // For action group subtasks, find a matching action group parent
          else if (actionGroupType && (
              task.title.includes("Action Group Tool") || 
              task.title.includes("Action Group ")
            )) {
            console.log(`Found Action Group parent task: ${task.title} for subtask: ${subtaskType}`);
            parentTaskIndex = i;
            break;
          }
          // For knowledge base subtasks, find a matching knowledge base parent
          else if (knowledgeBaseType && (
              task.title.includes("Knowledge Base") || 
              task.title.includes("Knowledge Base Tool")
            )) {
            console.log(`Found Knowledge Base parent task: ${task.title} for subtask: ${subtaskType}`);
            parentTaskIndex = i;
            break;
          }
          // Default fallback - any task with a step number
          else if (task.stepNumber > 0) {
            // Found a suitable parent task
            parentTaskIndex = i;
            break;
          }
        }
      } else {
        // Regular step with incremented number
        const lastStepNumber = Math.max(
          ...existingTraceGroup.tasks
            .filter(task => task.stepNumber > 0)
            .map(task => task.stepNumber)
        );
        
      // Enhanced handling for "Invoking Model" steps to ensure inputs and outputs use the same step number
    if (stepTitle === "Invoking Model") {
      const hasInput = !!rawTraceData.trace?.orchestrationTrace?.modelInvocationInput;
      const hasOutput = !!rawTraceData.trace?.orchestrationTrace?.modelInvocationOutput;

      // For outputs without inputs, try aggressive pairing with existing model input steps
      if (hasOutput && !hasInput) {
        // Try to find ANY model step with input but no output first
        console.log(`⚠️ CRITICAL OUTPUT PAIRING: Looking for input-only model invocation step`);
        let foundMatch = false;
        
        // Look through all tasks for a model step with input but no output 
        for (let i = existingTraceGroup.tasks.length - 1; i >= 0; i--) {
          const task = existingTraceGroup.tasks[i];
          
          if (task.title.includes("Invoking Model")) {
            // Check if it has Model Input but no Model Output
            if (task.subTasks && 
                task.subTasks.some(st => st.title.includes("Model Input")) &&
                !task.subTasks.some(st => st.title.includes("Model Output"))) {
              
              console.log(`✅ FOUND MATCHING INPUT! Using step ${task.stepNumber} at index ${i}`);
              
              // Found a match - use this step's number and index
              stepNumber = task.stepNumber;
              parentTaskIndex = i;
              
              // Set up to add Model Output as a subtask
              subtaskType = "Model Output";
              foundMatch = true;
              break;
            }
          }
        }
        
        // If we found a match, don't create a new task
        if (foundMatch) {
          console.log(`PAIRED: Output trace will be added to step ${stepNumber}`);
        } else {
          // No matching input found, create a new step
          stepNumber = lastStepNumber + 1; 
          console.log(`NO MATCH: Creating new step ${stepNumber} for output`);
        }
      } else if (hasInput) {
        // For input traces, always create a new step
        stepNumber = lastStepNumber + 1;
        console.log(`Creating step ${stepNumber} for input`);
      } else {
        // For other model traces, use standard logic
        if (shouldIncrementStepCounter(stepTitle, existingTraceGroup)) {
          stepNumber = lastStepNumber + 1;
        } else {
          stepNumber = lastStepNumber;
        }
      }
    }
    // Regular step with incremented number
    else if (shouldIncrementStepCounter(stepTitle, existingTraceGroup)) {
      stepNumber = lastStepNumber + 1;
    } else {
      stepNumber = lastStepNumber;
    }
      }
    }
    
    // Format title with step number if applicable
    let taskTitle = stepTitle || 'Processing';
    // Special handling for special trace types - don't label with step numbers
    if (isSpecialTraceType(stepTitle)) {
      taskTitle = stepTitle;
      // Make sure step number is 0 for special trace types
      stepNumber = 0;
    } else if (stepNumber > 0) {
      taskTitle = `Step ${stepNumber}: ${taskTitle}`;
    }
    
    if (isSpecialTraceType(stepTitle)) {
      // Special trace types may not need time indicators
      taskTitle = stepTitle;
    } else {
      // Show individual step time instead of accumulated time
      taskTitle = `${taskTitle} (${individualStepTime}s)`;
    }
    
      // Determine sequence number for this task to maintain chronological ordering
    // This is important for special trace types like Rationale that have stepNumber = 0
    let sequenceNumber = 0;
    if (existingTraceGroup && existingTraceGroup.tasks && existingTraceGroup.tasks.length > 0) {
      // Special case for "Rationale" - always position it after Routing Classifier (Step 1) and before Step 2
      if (stepTitle === "Rationale") {
        // Position it at 1.5 to be after Step 1 (Routing Classifier) but before Step 2
        sequenceNumber = 1.5;
      } else {
        // Find the highest sequence number used so far and increment
        sequenceNumber = Math.max(...existingTraceGroup.tasks
          .filter(task => task._sequenceNumber !== undefined)
          .map(task => task._sequenceNumber || 0)) + 1;
      }
    }
    
  // Create trace task entry
  const traceTask: Task = {
    stepNumber: stepNumber,
    title: taskTitle,
    // For special step types, set content appropriately
    content: (stepTitle === "Invoking Model") ? 
               "Model invocation details in subtasks below" : 
             (stepTitle.includes("Knowledge Base Tool")) ?
               displayContent || message :
             (stepTitle.includes("Action Group Tool")) ?
               displayContent || message :
             (stepTitle === "Routing Classifier") ?
               "Routing classifier operations" :
               displayContent || message,
    fullJson: fullJsonContent,
    timestamp: currentTime,
    _agentId: agentId,  // Track which agent this task belongs to
    _modelInvocationId: rawTraceData._modelInvocationId,  // Use the model invocation ID if available
    _sequenceNumber: sequenceNumber  // Add sequence number for chronological ordering
  };
    
  // Special case for routing classifier traces - ENHANCED version to ensure proper nesting structure
    if (isRoutingClassifierTrace) {
      // If we need a parent and don't have one yet
      if (parentTaskIndex < 0) {
        // Create a parent "Routing Classifier" task - always step 1
        const parentTask: Task = {
          stepNumber: 1, // Always step 1 for Routing Classifier
          title: `Step 1: Routing Classifier (${individualStepTime}s)`,
          content: "Routing classifier operations",
          fullJson: null,
          timestamp: currentTime,
          _agentId: agentId,
          _isRoutingClassifierParent: true,  // Mark as routing classifier parent
          _sequenceNumber: 1,  // Always first in sequence order
          subTasks: []  // Initialize subtasks array
        };
        
        // Add the parent task
        existingTraceGroup.tasks.push(parentTask);
        
        // Get the index of the newly added parent task
        parentTaskIndex = existingTraceGroup.tasks.length - 1;
        console.log(`Created new Routing Classifier parent task at index ${parentTaskIndex}`);
      }
      
      // Add the routing classifier trace as a subtask with correct nesting structure
      const parentTask = existingTraceGroup.tasks[parentTaskIndex];
      
      // Make sure the specific subtypes appear under Routing Classifier properly
      // This ensures "Classifying Intent" and "Routing Classifier Decision" are properly nested
      if (stepTitle === "Classifying Intent" || stepTitle === "Routing Classifier Decision") {
        // Use the exact step title to preserve the hierarchy
        addSubTask(
          parentTask,
          stepTitle, // Using the exact step title preserves the hierarchical structure
          displayContent || message,
          fullJsonContent,
          currentTime
        );
        console.log(`Added ${stepTitle} as a properly nested subtask under Routing Classifier`);
      } else {
        // For other routing classifier operations
        addSubTask(
          parentTask,
          subtaskType || "Routing Classifier Operation",
          displayContent || message,
          fullJsonContent,
          currentTime
        );
      }
    }
    // Other subtask types
    else if (parentTaskIndex >= 0 && subtaskType) {
      const parentTask = existingTraceGroup.tasks[parentTaskIndex];
      addSubTask(
        parentTask,
        subtaskType,
        displayContent || message,
        fullJsonContent,
        currentTime
      );
    } else {
      // Add as a normal task
      existingTraceGroup.tasks.push(traceTask);
      
      // If this is a special step type that needs subtasks created automatically
      const parentTask = existingTraceGroup.tasks[existingTraceGroup.tasks.length - 1];
      
      // Always initialize subTasks array if it doesn't exist
      if (!parentTask.subTasks) {
        parentTask.subTasks = [];
      }
        
      // Handle different step types with appropriate subtasks
      if (stepTitle === "Invoking Model") {
        // Add Model Input subtask only if we're handling the input trace
        if (rawTraceData.trace?.orchestrationTrace?.modelInvocationInput) {
          // Get the model input content to display
          let inputContent: string | object = modelInputContent || "Model input data";
          if (rawTraceData.trace?.orchestrationTrace?.modelInvocationInput) {
            inputContent = modelInputContent || JSON.stringify(rawTraceData.trace.orchestrationTrace.modelInvocationInput, null, 2);
          }
          
          // Explicitly add a Model Input subtask with proper timing
          const timeDifference = ((currentTime - parentTask.timestamp) / 1000).toFixed(2);
          const formattedTime = parseFloat(timeDifference).toFixed(2);
          
          // Create and add the Model Input subtask
          const modelInputSubtask: SubTask = {
            title: `Model Input (${formattedTime}s)`,
            content: inputContent,
            fullJson: fullJsonContent,
            timestamp: currentTime
          };
          
          // Add this at the beginning of subtasks array to ensure it's first
          parentTask.subTasks.unshift(modelInputSubtask);
        }
        
        // Only add Model Output subtask if we're handling the output trace
        if (rawTraceData.trace?.orchestrationTrace?.modelInvocationOutput) {
          // If we have display content from the output, use it, otherwise show the raw output
          const outputContent = displayContent || 
            (rawTraceData.trace?.orchestrationTrace?.modelInvocationOutput ? 
              JSON.stringify(rawTraceData.trace.orchestrationTrace.modelInvocationOutput, null, 2) : 
              "Model output details");
              
          addSubTask(
            parentTask,
            "Model Output",
            outputContent,
            fullJsonContent,
            currentTime
          );
        }
      }
      // Handle Knowledge Base Tool tasks
      else if (stepTitle.includes("Knowledge Base Tool")) {
        // Create a KB Query Input subtask with the query text
        const timeDifference = ((currentTime - parentTask.timestamp) / 1000).toFixed(2);
        const formattedTime = parseFloat(timeDifference).toFixed(2);
        
        // Get the query content
        let queryContent = displayContent || "Knowledge base query";
        if (rawTraceData.trace?.orchestrationTrace?.invocationInput?.knowledgeBaseLookupInput?.text) {
          queryContent = rawTraceData.trace.orchestrationTrace.invocationInput.knowledgeBaseLookupInput.text;
        }
        
        // Set the parent task content to be the query content directly
        // This prevents an intermediate dropdown from forming
        parentTask.content = "Knowledge base tool details:";
        
        // Create and add the KB Query subtask
        const kbQuerySubtask: SubTask = {
          title: `Knowledge Base Query (${formattedTime}s)`,
          content: queryContent,
          fullJson: fullJsonContent,
          timestamp: currentTime
        };
        
        // Add this at the beginning of subtasks array
        parentTask.subTasks.unshift(kbQuerySubtask);
      }
      // Handle Action Group tasks
    else if (stepTitle.includes("Action Group Tool")) {
      // Create an Action Group Input subtask with the input data
      const timeDifference = ((currentTime - parentTask.timestamp) / 1000).toFixed(2);
      const formattedTime = parseFloat(timeDifference).toFixed(2);
      
      // Get the action group input content
      let actionContent = displayContent || "Action group input";
      if (rawTraceData.trace?.orchestrationTrace?.invocationInput?.actionGroupInvocationInput) {
        const actionInput = rawTraceData.trace.orchestrationTrace.invocationInput.actionGroupInvocationInput;
        
        // Try to extract meaningful content
        if (actionInput.requestBody?.content?.['application/json']) {
          const jsonContent = actionInput.requestBody.content['application/json'];
          if (Array.isArray(jsonContent) && jsonContent.length > 0 && jsonContent[0].value) {
            actionContent = JSON.stringify(jsonContent[0].value, null, 2);
          } else {
            actionContent = JSON.stringify(jsonContent, null, 2);
          }
        } else {
          actionContent = JSON.stringify(actionInput, null, 2);
        }
      }
      
      // Set the parent task content to be a descriptive text (not just placeholder)
      // This prevents an intermediate dropdown from forming
      parentTask.content = "Action group tool details:";
      
      // Create and add the Action Group Input subtask
      const actionGroupSubtask: SubTask = {
        title: `Action Group Input (${formattedTime}s)`,
        content: actionContent,
        fullJson: fullJsonContent,
        timestamp: currentTime
      };
      
      // Add this at the beginning of subtasks array
      parentTask.subTasks.unshift(actionGroupSubtask);
    } 
    // Special case for initial Routing Classifier traces when creating a new trace group
    else if (isRoutingClassifierTrace) {
      // Create a "Routing Classifier" parent task with this as its first subtask - always step 1
      const routingClassifierTask: Task = {
        stepNumber: 1, // Always step 1 for Routing Classifier
        title: `Step 1: Routing Classifier (0.00s)`,
        content: "Routing classifier operations",
        fullJson: null,
        timestamp: currentTime,
        _agentId: agentId,
        _isRoutingClassifierParent: true,
        _sequenceNumber: 1, // Always first in sequence
        subTasks: []
      };
      
      // Add the subtask
      addSubTask(
        routingClassifierTask, 
        subtaskType || getStepTitle(rawTraceData),
        displayContent || message,
        fullJsonContent,
        currentTime
      );
      
      // Add the parent task with subtask to the trace group
      existingTraceGroup.tasks.push(routingClassifierTask);
    }
    }
    
    // Check if this trace indicates completion (e.g. final response) - more aggressive detection
    if (stepTitle === 'Final Response' || 
        rawTraceData.trace?.orchestrationTrace?.observation?.finalResponse ||
        traceTask.title === 'Final Response') {
      console.log('🔍 Marked trace as complete - Final Response detected with timestamp', Date.now());
      
      // Calculate accumulated time from all tasks and subtasks - this ensures consistency with TraceGroup.tsx
      let totalTime = 0;
      
      // Process main tasks
      if (existingTraceGroup.tasks && Array.isArray(existingTraceGroup.tasks)) {
        existingTraceGroup.tasks
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
      
      // Extract the actual final response content - this applies to all agents
      const finalResponseContent = 
        rawTraceData.trace?.orchestrationTrace?.observation?.finalResponse?.text ||
        displayContent ||
        message;
      
      // Set common final response properties for all agent types
      existingTraceGroup.isComplete = true;
      existingTraceGroup.finalElapsedTime = totalTime.toFixed(2);
      existingTraceGroup.hasFinalResponse = true;
      existingTraceGroup.finalResponseTimestamp = Date.now();
      existingTraceGroup.finalResponseContent = finalResponseContent;
      
      // Special handling for Supervisor agent final responses - dispatch events for UI rendering
      if (agentType === AGENT_TYPES.SUPERVISOR) {
        if (finalResponseContent) {
          // Mark this trace group as having a final supervisor response
          existingTraceGroup.isSupervisorFinalResponse = true;
          
          // Dispatch a custom event for immediate rendering of Supervisor final response
          const supervisorFinalResponseEvent = new CustomEvent('supervisorFinalResponse', {
            detail: {
              content: finalResponseContent,
              traceId: groupId,
              timestamp: Date.now(),
              traceGroup: existingTraceGroup
            }
          });
          console.log('🔔 [traceParser] Dispatching supervisorFinalResponse event');
          document.dispatchEvent(supervisorFinalResponseEvent);
        }
      } else {
        // For non-Supervisor agents, log the final response detection but don't dispatch UI events
        console.log(`Final response detected for ${agentType} agent: ${finalResponseContent.substring(0, 50)}...`);
      }
    }
    
    // Also update the text content for summary display
    if (displayContent) {
      // Only update text if we have meaningful content
      existingTraceGroup.text = displayContent;
    }
  } else {
    // Create new trace group and add to state
    let displayName = agentType;
    
    // For special agent types, ensure we use consistent display names
    if (agentType === AGENT_TYPES.ROUTING_CLASSIFIER) {
      displayName = 'Routing Classifier'; // More readable name
    } else if (agentType === AGENT_TYPES.SUPERVISOR) {
      displayName = 'Supervisor';
    } else if (agentType === AGENT_TYPES.PRODUCT_RECOMMENDATION) {
      displayName = 'ProductRecommendation';
    } else if (agentType === AGENT_TYPES.TROUBLESHOOT) {
      displayName = 'Troubleshoot';
    } else if (agentType === AGENT_TYPES.PERSONALIZATION) {
      displayName = 'Personalization';
    } else if (agentType === AGENT_TYPES.ORDER_MANAGEMENT) {
      displayName = 'OrderManagement';
    }
    
    // Make sure we always have a proper dropdownTitle
    // Ensure original trace data is preserved in debuggable form
    const traceGroup: TraceGroup = {
      id: groupId,
      type: 'trace-group',
      sender: 'bot',
      dropdownTitle: `${displayName} (${message.slice(0, 30)}${message.length > 30 ? '...' : ''})`,
      startTime: currentTime,
      tasks: [],
      text: message || displayContent || '[Processing...]',
      agentId: agentId,
      originalAgentType: rawTraceData.collaboratorName || displayName,
      orchestrationTraceType: traceType,
      lastUpdateTime: currentTime,
      agentName: rawTraceData.agentName, // Include agentName for filtering
      // Add debug info to help troubleshoot
      _debug: {
        detectedType: agentType,
        rawAgentId: rawTraceData.agentId,
        rawCollaborator: rawTraceData.collaboratorName,
        rawAgentName: rawTraceData.agentName
      }
    };
    
    // Format title with step number
    // Calculate the appropriate step number for this trace
    // If it's the first step, use 1, otherwise find the highest step number and increment
    let calculatedStepNumber = 1; // default step number
    
    if (existingTraceGroup && existingTraceGroup.tasks && existingTraceGroup.tasks.length > 0) {
      // Find the highest step number used so far
      const highestStep = Math.max(
        ...existingTraceGroup.tasks
          .filter(task => task.stepNumber > 0)
          .map(task => task.stepNumber)
      );
      calculatedStepNumber = highestStep + 1;
    }
    
    // Special handling for special trace types - don't label with step numbers
    let taskTitle = "";
    if (isSpecialTraceType(stepTitle)) {
      // For special trace types like Rationale, use the type name directly
      taskTitle = `${stepTitle} (0.00s)`;
      stepNumber = 0; // Use 0 to indicate no step number
    } else {
      taskTitle = `Step ${calculatedStepNumber}: ${stepTitle || 'Processing'} (0.00s)`;
      // Update the step number to match the title
      stepNumber = calculatedStepNumber;
    }
    
    // Generate model invocation ID if needed
    if (stepTitle === "Invoking Model") {
      // Create a unique model invocation ID for this new model step
      const hasInput = !!rawTraceData.trace?.orchestrationTrace?.modelInvocationInput;
      const hasOutput = !!rawTraceData.trace?.orchestrationTrace?.modelInvocationOutput;
      
      if (hasInput || hasOutput) {
        // Generate a model invocation ID using the agent ID and timestamp
        rawTraceData._modelInvocationId = `model-${agentId}-${traceId}-${Date.now()}`;
        console.log(`Generated new model invocation ID for new trace: ${rawTraceData._modelInvocationId}`);
      }
    }
    
  // Special handling for "Classifying Intent" and "Routing Classifier Decision" to always be nested
  if (stepTitle === "Classifying Intent" || stepTitle === "Routing Classifier Decision") {
    // Create a parent "Routing Classifier" task first
    const routingClassifierTask: Task = {
      stepNumber: 1, // Always step 1 for Routing Classifier
      title: `Step 1: Routing Classifier (0.00s)`,
      content: "Routing classifier operations",
      fullJson: null,
      timestamp: currentTime,
      _groupId: groupId,
      _agentId: agentId,
      _isRoutingClassifierParent: true,
      _sequenceNumber: 1, // Always first in sequence
      subTasks: []
    };
    
    // Create the subtask ("Classifying Intent" or "Routing Classifier Decision")
    const subtask: SubTask = {
      title: `${stepTitle} (0.00s)`,
      content: displayContent || message,
      fullJson: fullJsonContent,
      timestamp: currentTime
    };
    
    // Add the subtask to the parent
    routingClassifierTask.subTasks = [subtask];
    
    // Add the parent task with subtask to the trace group
    traceGroup.tasks.push(routingClassifierTask);
  } else {
    // Normal case - create initial trace task entry
    const traceTask: Task = {
      stepNumber: stepNumber,
      title: taskTitle,
      // For special step types, set content appropriately
      content: (stepTitle === "Invoking Model") ? 
                "Model invocation details in subtasks below" : 
              (stepTitle.includes("Knowledge Base Tool")) ?
                displayContent || message :
              (stepTitle.includes("Action Group Tool")) ?
                displayContent || message :
                displayContent || message,
      fullJson: fullJsonContent,
      timestamp: currentTime,
      _groupId: groupId,
      _agentId: agentId,  // Track which agent this task belongs to
      _modelInvocationId: rawTraceData._modelInvocationId,  // Set model invocation ID if available
      subTasks: [] // Initialize subtasks array for all tasks
    };
    
    traceGroup.tasks.push(traceTask);
    
    // Handle special step types with appropriate subtasks
    if (stepTitle === "Invoking Model" || 
        stepTitle.includes("Knowledge Base Tool") || 
        stepTitle.includes("Action Group Tool:")) {
      
      const timeDifference = ((currentTime - traceTask.timestamp) / 1000).toFixed(2);
      const formattedTime = parseFloat(timeDifference).toFixed(2);
        
      // Handle specific step types with appropriate subtasks
      if (stepTitle === "Invoking Model") {
        // Add Model Input subtask only if we're handling the input trace
        if (rawTraceData.trace?.orchestrationTrace?.modelInvocationInput) {
          // Get the model input content to display
          let inputContent: string | object = "Model input data";
          if (modelInputContent) {
            inputContent = modelInputContent;
          } else if (rawTraceData.trace?.orchestrationTrace?.modelInvocationInput) {
            inputContent = JSON.stringify(rawTraceData.trace.orchestrationTrace.modelInvocationInput, null, 2);
          }
          
          // Create and add the Model Input subtask
          const modelInputSubtask: SubTask = {
            title: `Model Input (${formattedTime}s)`,
            content: inputContent,
            fullJson: fullJsonContent,
            timestamp: currentTime
          };
          
          // Add this at the beginning of subtasks array
          traceTask.subTasks.unshift(modelInputSubtask);
        }
        
        // Add Model Output subtask only if we're handling the output trace
        if (rawTraceData.trace?.orchestrationTrace?.modelInvocationOutput) {
          // If we have display content from the output, use it, otherwise show the raw output
          const outputContent = displayContent || 
            (rawTraceData.trace?.orchestrationTrace?.modelInvocationOutput ? 
              JSON.stringify(rawTraceData.trace.orchestrationTrace.modelInvocationOutput, null, 2) : 
              "Model output details");
              
          const modelOutputSubtask: SubTask = {
            title: `Model Output (${formattedTime}s)`,
            content: outputContent,
            fullJson: fullJsonContent,
            timestamp: currentTime
          };
          
          // Add this after the input subtask (if it exists)
          traceTask.subTasks.push(modelOutputSubtask);
        }
      }
      // Handle Knowledge Base Tool tasks
      else if (stepTitle.includes("Knowledge Base Tool")) {
        // Get the query content
        let queryContent = displayContent || "Knowledge base query";
        if (rawTraceData.trace?.orchestrationTrace?.invocationInput?.knowledgeBaseLookupInput?.text) {
          queryContent = rawTraceData.trace.orchestrationTrace.invocationInput.knowledgeBaseLookupInput.text;
        }
        
        // Set the parent task content to be descriptive
        // This prevents an intermediate dropdown from forming
        traceTask.content = "Knowledge base tool details:";
        
        // Create and add the KB Query subtask
        const kbQuerySubtask: SubTask = {
          title: `Knowledge Base Query (${formattedTime}s)`,
          content: queryContent,
          fullJson: fullJsonContent,
          timestamp: currentTime
        };
        
        // Add this at the beginning of subtasks array
        traceTask.subTasks.unshift(kbQuerySubtask);
      }
      // Handle Action Group tasks
      else if (stepTitle.includes("Action Group Tool:")) {
        // Get the action group input content
        let actionContent = displayContent || "Action group input";
        if (rawTraceData.trace?.orchestrationTrace?.invocationInput?.actionGroupInvocationInput) {
          const actionInput = rawTraceData.trace.orchestrationTrace.invocationInput.actionGroupInvocationInput;
          
          // Try to extract meaningful content
          if (actionInput.requestBody?.content?.['application/json']) {
            const jsonContent = actionInput.requestBody.content['application/json'];
            if (Array.isArray(jsonContent) && jsonContent.length > 0 && jsonContent[0].value) {
              actionContent = JSON.stringify(jsonContent[0].value, null, 2);
            } else {
              actionContent = JSON.stringify(jsonContent, null, 2);
            }
          } else {
            actionContent = JSON.stringify(actionInput, null, 2);
          }
        }
        
        // Set the parent task content to be descriptive
        // This prevents an intermediate dropdown from forming
        traceTask.content = "Action group tool details:";
        
        // Create and add the Action Group Input subtask
        const actionGroupSubtask: SubTask = {
          title: `Action Group Input (${formattedTime}s)`,
          content: actionContent,
          fullJson: fullJsonContent,
          timestamp: currentTime
        };
        
        // Add this at the beginning of subtasks array
        traceTask.subTasks.unshift(actionGroupSubtask);
      }
    }
  }
  
  newState.messages.push(traceGroup);
  }
  
  return newState;
}

// Helper function to test trace detection directly in the console
export function debugTraceDetection(traceData: any) {
  console.group('🔬 Trace Detection Debug');
  
  try {
    // Original data
    console.log('Raw trace data:', traceData);
    
    // Run detection
    const detectedType = getAgentTypeFromTrace(traceData);
    console.log(`Detected agent type: ${detectedType}`);
    
    // Check each detection method in isolation
    const methods = {
      'Has routingClassifierTrace': !!traceData?.trace?.routingClassifierTrace,
      'Has trace_type field': !!traceData?.trace?.trace_type,
      'Has supervisorMetadata': !!traceData?.supervisorMetadata,
      'Exact name match - routing_classifier': 
        traceData?.agentName === 'routing_classifier' || 
        traceData?.collaboratorName === 'routing_classifier',
      'Exact name match - Supervisor': 
        traceData?.agentName === 'Supervisor' || 
        traceData?.collaboratorName === 'Supervisor',
      'Name includes routing/classifier': 
        (traceData?.agentName || '').toLowerCase().includes('routing') || 
        (traceData?.agentName || '').toLowerCase().includes('classifier') || 
        (traceData?.collaboratorName || '').toLowerCase().includes('routing') || 
        (traceData?.collaboratorName || '').toLowerCase().includes('classifier'),
      'Name includes supervisor/unknown': 
        (traceData?.agentName || '').toLowerCase().includes('supervisor') || 
        (traceData?.agentName || '').toLowerCase().includes('unknown') || 
        (traceData?.collaboratorName || '').toLowerCase().includes('supervisor') || 
        (traceData?.collaboratorName || '').toLowerCase().includes('unknown'),
      'Has supervisor traits': !!(
        traceData?.trace?.orchestrationTrace?.rationale ||
        traceData?.trace?.orchestrationTrace?.observation?.finalResponse
      )
    };
    
    console.table(methods);
  } catch (e) {
    console.error('Error in trace detection:', e);
  }
  
  console.groupEnd();
  
  return 'Debug complete - see console for results';
}

// Helper function to set up development environment configuration for agent IDs
export function setupDevAgentConfig() {
  if (!import.meta.env.DEV) {
    console.error('Development configuration can only be set in development mode');
    return false;
  }

  try {
    // Set reasonable default values for development
    const config = {
      VITE_ROUTING_CLASSIFIER_AGENT_ID: "routing-classifier-agent-id",
      VITE_ROUTING_CLASSIFIER_ALIAS_ID: "routing-classifier-alias-id"
    };

    localStorage.setItem('dev-agent-config', JSON.stringify(config));
    console.log('Development configuration set up with default values. Reload the page to apply changes.');
    console.log('Config values:', config);
    return true;
  } catch (e) {
    console.error('Failed to save development configuration', e);
    return false;
  }
}

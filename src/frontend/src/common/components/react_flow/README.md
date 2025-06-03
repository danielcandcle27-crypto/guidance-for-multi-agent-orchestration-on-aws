# React Flow Components for Agent Visualization

This directory contains React components for visualizing AI agent orchestration and execution traces. It provides a comprehensive visual interface for displaying agent interactions, trace data, and processing flows.

## Core Components

### Agent Flow Visualization

- **AgentFlowPanel.tsx**: The main component that displays the interactive agent flow diagram. It shows connections between agents, processing states, and handles trace data visualization through WebSocket connections.
- **AgentFlowNodeConfig.tsx**: Configuration for the initial nodes and edges in the agent flow diagram. Defines the structure of agent relationships.
- **CustomAgentNode.tsx**: Specialized node component for visualizing different types of agents with appropriate styling and status indicators.
- **CustomEdge.tsx**: Custom edge component for visualizing connections between agents, including support for animated and highlighted states.

### Agent Trace Visualization

- **TraceGroup.tsx**: Renders a collapsible UI element displaying execution traces from AI agents in a hierarchical format. Handles nested task structures including:
  - Model Input/Output pairs
  - Knowledge Base operations
  - Action Group operations
  - Processing steps with timing information
- **TraceModal.tsx**: Modal dialog that displays detailed trace information for agents, showing execution details like start time, duration, completion status, and step-by-step trace data.
- **TraceView.tsx**: Component for displaying trace information in different contexts.

### Support Components & Utilities

- **BedrockTheme.tsx**: Theme provider for consistent styling aligned with AWS Bedrock design guidelines.
- **EdgePopup.tsx**: Popup component for displaying information when edges are clicked or hovered.
- **ProcessingIndicator.tsx**: Visual indicator component for agent processing states.
- **FlowComponents.css**: CSS styling specific to the flow visualization components.
- **FlowUtils.ts**: Utility functions for the flow diagram, including color management and node positioning.

### State Management

- **FlowReset.ts/tsx**: Utilities for resetting the flow diagram state to initial conditions.
- **FlowResetExample.tsx**: Example implementation of flow reset functionality.

## Key Features

- **Real-time Visualization**: Agent interactions are shown in real-time as they process requests.
- **Animated Flows**: Messages flowing between agents are visualized with animated paths.
- **Hierarchical Trace Display**: Execution traces are displayed in a collapsible, hierarchical format.
- **Model Input/Output Nesting**: "Model Input" and "Model Output" traces are properly nested under "Invoking Model" parent tasks.
- **Interactive Node Selection**: Click on agents to view detailed trace information.
- **Processing State Indicators**: Visual indicators for active, completed, and idle agent states.

## Integration Points

This visualization system integrates with:

1. WebSocket connections for real-time trace data
2. Local storage for persisting trace information
3. Custom events for cross-component communication
4. AWS Cloudscape Design System for UI components

## Usage Example

The main flow diagram is typically mounted in a chat or conversation interface:

```tsx
import { AgentFlowPanel } from '../common/components/react_flow/AgentFlowPanel';

// In a React component:
<AgentFlowPanel 
  height="500px"
  sessionId={conversationSessionId}
  modelId="us.amazon.nova-micro-v1:0" 
/>
```

## Troubleshooting

For trace visualization issues:
1. Check WebSocket connections for real-time updates
2. Verify trace data structure in the browser storage
3. Ensure "Model Input" and "Model Output" are properly nested under "Invoking Model"
4. Check CSS styles for proper animation and node highlights

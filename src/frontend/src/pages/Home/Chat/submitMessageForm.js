// This file contains the updated submitMessageForm function with animation reset capabilities

// Import resetFlowAnimations from our FlowReset module
import { resetFlowAnimations } from '../../../common/components/react_flow/FlowReset';
import { setFlowAnimationsFrozen, resetProcessingState } from '../../../utilities/killSwitch';

export const submitMessageForm = async function() {
    if (!this.message.trim()) return;

    // First reset all previous animations to ensure a clean slate
    resetFlowAnimations();
    
    // Then force stop ongoing animations and freeze new animations to preserve trace data
    this.stopAllTextAnimations();
    setFlowAnimationsFrozen(true);
    
    // ALWAYS force remove ALL previous messages except the initial greeting
    // This ensures a clean slate for the new conversation
    console.log("Removing ALL previous messages before sending new message");
    this.setMessages(prev => prev.filter(msg => 
        msg.id === "1" && msg.type === "assistant" // Keep ONLY the initial greeting
    ));

    // Add user message to chat
    const userMessage = {
        id: Date.now().toString(),
        type: "user",
        content: this.message,
        timestamp: new Date().toLocaleTimeString(),
    };

    // Create a unique ID for the assistant's response
    const responseId = (Date.now() + 1).toString();

    // Store the message to send
    const messageToSend = this.message;

    // First update with just the user message
    this.setMessages((prev) => [...prev, userMessage]);

    // Reset the trace state when starting a new conversation
    this.setTraceState({
        messages: [],
        currentTrace: '',
        currentSubTrace: '',
        traceStepCounter: {}
    });

    // Set loading state and store the response ID for later updates
    this.setCurrentResponseId(responseId);
    this.setIsLoading(true);
    this.setMessage(""); // Clear input immediately for better UX

    // Rest of the function...
    // Implementation will continue as in the original code
    console.log("Message prepared for sending with animation reset");
};

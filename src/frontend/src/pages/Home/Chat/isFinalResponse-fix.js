// This is a fix for the truncated part of your index.tsx file
// Replace the incomplete isFinalResponse section with this code:

// Check for final response indicators more thoroughly
const isFinalResponse = 
    newContent.includes("Can I help you with anything else?") ||
    newContent.includes("Is there anything else") ||
    newContent.includes("In conclusion") ||
    newContent.includes("To summarize") ||
    newContent.includes("I hope this helps") ||
    newContent.includes("Please let me know if you have any questions");

// For final messages:
// 1. Always update to ensure complete content is displayed
// 2. Force immediate rendering with a synchronous update
// 3. Explicitly stop loading state
if (isFinalResponse) {
    console.log("Final response detected in subscription update, forcing immediate display");
    
    // Stop any active streaming
    document.dispatchEvent(new Event('stopAllTextAnimations'));
    
    // Update synchronously rather than with setTimeout
    setMessages((prev) =>
        prev.map((msg) =>
            msg.id === currentResponseId
                ? { ...msg, content: newContent }
                : msg
        )
    );
    
    // Explicitly end loading state
    setIsLoading(false);
    setCurrentResponseId(null);
    
    return; // Skip the delayed update below
}
// For non-final messages, use original logic
else if (Math.abs(newContent.length - currentContent.length) >= 15) {
    // Update with a small delay to avoid render conflicts
    setTimeout(() => {
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === currentResponseId
                    ? { ...msg, content: newContent }
                    : msg
            )
        );
    }, 10);
}

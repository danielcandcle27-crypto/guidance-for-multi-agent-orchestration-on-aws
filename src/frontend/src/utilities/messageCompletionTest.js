/**
 * Message Completion Test Utility
 * 
 * This utility provides test functions to verify message completion behavior
 * for product recommendations and other final messages.
 */

// Function to verify message completion for product recommendations
export function testMessageCompletion() {
  console.log("⚠️ Running message completion test");
  
  const messageTypes = [
    {
      type: "Product Recommendations",
      content: `
Recommended Products:

ThunderBolt Speaker
- High sound quality with deep bass
- Bluetooth 5.0 for stable connection
- 24-hour battery life

SonicWave Bluetooth Speaker
- Water-resistant design
- LED light display
- Premium sound with enhanced bass

Troubleshooting Tips:
For the ThunderBolt Speaker:
- Bass quality is lacking - Adjust the equalizer settings and ensure the speaker is compatible with the connected device.
- Speaker isn't charging - Use the original charger or try a different USB cable.
- Sound cuts out intermittently - Move the speaker closer to the connected device.

For the SonicWave Bluetooth Speaker:
- Connection issues - Reset the speaker by holding the power button for 10 seconds.
- Battery drains quickly - Turn off LED lights to save battery.
- Device not found - Ensure Bluetooth is enabled on your device.
`
    },
    {
      type: "Standard Final Response",
      content: `I've analyzed the issue with your speaker and provided some suggestions above. 
      
Can I help you with anything else?`
    }
  ];
  
  // Log test cases
  messageTypes.forEach(({type, content}) => {
    console.log(`Test case for ${type}:`);
    console.log(`Content length: ${content.length} characters`);
    
    // Check if product-specific terms are detected
    const productTerms = ["ThunderBolt Speaker", "SonicWave", "Recommended Products:", "Troubleshooting Tips:"];
    const foundTerms = productTerms.filter(term => content.includes(term));
    
    if (foundTerms.length > 0) {
      console.log(`Found product terms: ${foundTerms.join(", ")}`);
    } else {
      console.log("No product terms detected");
    }
    
    // Test localStorage backup
    const testId = `test-${Date.now()}`;
    localStorage.setItem(`complete_message_${testId}`, content);
    
    // Verify storage
    const storedContent = localStorage.getItem(`complete_message_${testId}`);
    const storageSuccess = storedContent && storedContent.length === content.length;
    
    console.log(`Storage test: ${storageSuccess ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`Stored content length: ${storedContent?.length || 0} characters`);
    
    // Clean up test data
    localStorage.removeItem(`complete_message_${testId}`);
    console.log("---------------------------------------");
  });
  
  // Test force complete functionality
  console.log("Testing force complete event:");
  document.dispatchEvent(new Event('forceCompleteTextContent'));
  console.log("✅ Force complete event dispatched");
  
  return "Message completion test completed - check console for detailed results";
}

// Function to simulate a message rendering sequence
export function simulateMessageRendering(content, messageId = `test-${Date.now()}`) {
  return new Promise((resolve) => {
    console.log(`⏱️ Simulating rendering of message (${content.length} chars)...`);
    
    // Step 1: Store in localStorage
    localStorage.setItem(`complete_message_${messageId}`, content);
    
    // Step 2: Dispatch events as they would occur during normal rendering
    setTimeout(() => {
      // Simulate start of rendering
      console.log("📱 Phase 1: Starting message rendering");
      
      // Sim initial chunk (first 50 chars)
      const initialChunk = content.substring(0, Math.min(50, content.length));
      console.log(`First chunk: "${initialChunk}..."`);
      
      // Step 3: After a delay, simulate completion
      setTimeout(() => {
        console.log("📱 Phase 2: Final message detected");
        document.dispatchEvent(new CustomEvent('finalMessageDetected', {
          detail: { content: content, messageId: messageId }
        }));
        
        // Step 4: Final completion
        setTimeout(() => {
          console.log("📱 Phase 3: Rendering complete, dispatching final event");
          document.dispatchEvent(new CustomEvent('finalMessageRendered', {
            detail: { content: content, messageId: messageId }
          }));
          
          // Clean up
          localStorage.removeItem(`complete_message_${messageId}`);
          console.log("🧹 Test cleanup complete");
          resolve("Simulation complete");
        }, 500);
      }, 500);
    }, 500);
  });
}

// Monitor localStorage events to help detect when product messages are stored/retrieved
export function monitorLocalStorageForProducts() {
  console.log("🔍 Starting monitoring for product-related messages in localStorage");
  
  // Original methods
  const originalSetItem = localStorage.setItem;
  const originalGetItem = localStorage.getItem;
  
  // Override setItem to log product-related content
  localStorage.setItem = function(key, value) {
    if (typeof value === 'string' && 
        (value.includes("ThunderBolt") || 
         value.includes("SonicWave") || 
         value.includes("Recommended Products") || 
         key.includes("product_message"))) {
      console.log(`📥 Product content saved to localStorage: key=${key}, length=${value.length}`);
    }
    return originalSetItem.call(this, key, value);
  };
  
  // Override getItem to log product-related content retrieval
  localStorage.getItem = function(key) {
    const value = originalGetItem.call(this, key);
    if (typeof value === 'string' && 
        (value.includes("ThunderBolt") || 
         value.includes("SonicWave") || 
         value.includes("Recommended Products") || 
         key.includes("product_message"))) {
      console.log(`📤 Product content retrieved from localStorage: key=${key}, length=${value.length}`);
    }
    return value;
  };
  
  console.log("✅ Local storage monitoring active");
  
  // Return function to restore original methods
  return function stopMonitoring() {
    localStorage.setItem = originalSetItem;
    localStorage.getItem = originalGetItem;
    console.log("❌ Local storage monitoring stopped");
  };
}

// Exported object with all test functions
export const MessageTester = {
  runTests: testMessageCompletion,
  simulateRendering: simulateMessageRendering,
  monitorStorage: monitorLocalStorageForProducts
};

// Auto-execute test if this script is run directly
if (typeof window !== 'undefined' && window.document.title.includes('test')) {
  console.log("📝 Auto-executing test in test environment");
  setTimeout(testMessageCompletion, 1000);
}

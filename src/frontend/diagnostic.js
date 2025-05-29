// AppSync API Diagnostic Tool
// Run with: node diagnostic.js

// Check for any stored AppSync URL in localStorage
function checkLocalStorage() {
  try {
    console.log("🔍 Checking localStorage for saved AppSync endpoints...");
    
    // Mock localStorage for NodeJS environment
    const localStorage = {
      getItem: (key) => {
        try {
          // Try to load from a local file if running in Node
          const fs = require('fs');
          if (fs.existsSync('./.endpoints')) {
            return fs.readFileSync('./.endpoints', 'utf8');
          }
        } catch (e) {
          console.log("❌ Error reading endpoints file:", e);
        }
        return null;
      }
    };
    
    const savedEndpoints = localStorage.getItem('appSyncEndpoints');
    if (savedEndpoints) {
      try {
        const endpoints = JSON.parse(savedEndpoints);
        console.log("✅ Found saved AppSync endpoints:", endpoints);
        return endpoints.graphApiUrl;
      } catch (e) {
        console.error("❌ Error parsing saved endpoints:", e);
      }
    } else {
      console.log("❌ No saved AppSync endpoints found");
    }
  } catch (e) {
    console.error("Error checking localStorage:", e);
  }
  return null;
}

// Test direct AppSync connection
async function testAppSyncConnection(apiUrl) {
  console.log(`\n🔄 Testing connection to AppSync API: ${apiUrl}`);
  
  try {
    // Test if we can make a simple request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query TestConnection {
            __typename
          }
        `
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Connection successful:", data);
      return true;
    } else {
      console.log("❌ Connection failed with status:", response.status);
      const errorData = await response.text();
      console.log("Error response:", errorData);
      return false;
    }
  } catch (e) {
    console.error("❌ Connection error:", e);
    return false;
  }
}

// Test subscription setup
function testSubscription(apiUrl) {
  console.log(`\n🔄 Testing subscription to AppSync API: ${apiUrl}`);
  
  try {
    console.log("⚠️ WebSockets are not directly testable in Node environment");
    console.log("👉 Check browser console for subscription errors");
    console.log("👉 Common subscription errors:");
    console.log("   - Missing or incorrect API URL");
    console.log("   - Authorization errors (IAM/Cognito)");
    console.log("   - CORS issues preventing WebSocket connection");
    console.log("   - Network connectivity problems");
    
    return false;
  } catch (e) {
    console.error("❌ Subscription test error:", e);
    return false;
  }
}

// Find the AppSync API URL
async function findAppSyncUrl() {
  console.log("\n🔍 Looking for AppSync API URL...");
  
  // First check localStorage (or .endpoints file)
  const localStorageUrl = checkLocalStorage();
  if (localStorageUrl) {
    console.log("📋 Found URL in localStorage:", localStorageUrl);
    return localStorageUrl;
  }
  
  // Try fallback hardcoded URL
  console.log("⚠️ No URL found in storage, using fallback");
  return "https://YOUR-API-ID-HERE.appsync-api.YOUR-REGION-HERE.amazonaws.com/graphql";
}

// Main diagnostic function
async function runDiagnostic() {
  console.log("🔧 AppSync API Diagnostic Tool 🔧");
  console.log("=================================");
  
  // Step 1: Find the API URL
  const apiUrl = await findAppSyncUrl();
  
  // Step 2: Test direct connection
  await testAppSyncConnection(apiUrl);
  
  // Step 3: Test subscription
  testSubscription(apiUrl);
  
  console.log("\n✅ Diagnostic completed");
  console.log("Browser checks to perform:");
  console.log("1. Open browser console");
  console.log("2. Look for errors related to AppSync, GraphQL, or subscriptions");
  console.log("3. Check if WebSocket connections are established");
  console.log("4. Verify that AppSync API URL is correct");
}

// Run the diagnostic
runDiagnostic();

console.log("\n📝 Manual steps to resolve common issues:");
console.log("1. Verify API URL in environment variables");
console.log("2. Check network connectivity to AppSync endpoint");
console.log("3. Verify IAM permissions are correct");
console.log("4. Check CloudFormation for API outputs");
console.log("5. Regenerate GraphQL schema and types");
console.log("6. Try refreshing the local environment using CLI tools");

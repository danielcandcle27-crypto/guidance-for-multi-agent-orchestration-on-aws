import { useAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Container, Spinner } from "@cloudscape-design/components";
import { I18nProvider } from "@cloudscape-design/components/i18n";
import messages from "@cloudscape-design/components/i18n/messages/all.en";
import "@cloudscape-design/global-styles/index.css";
import "./common/components/styles/chat-bubble-fixes.css"; // Fix for chat bubble content truncation
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect, useRef, useState, useMemo } from "react";
import { FlashbarProvider } from "./common/contexts/Flashbar";
// Import our automatic localStorage cleanup utility for initialization
import "./utilities/localStorageCleanup"; // This will auto-initialize when imported
import Error from "./pages/Error";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import SimpleStreamingDemo from "./utilities/simpleStreamingComponent";

const LOCALE = "en";

const apiConfig = {
    headers: async () => {
        try {
            const session = await fetchAuthSession();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': navigator.userAgent || 'AppSync-Client/1.0',
                'Origin': window.location.origin
            };
            
            if (session.tokens?.idToken) {
                headers['Authorization'] = session.tokens.idToken.toString();
            }
            
            return headers;
        } catch (error) {
            // Return basic headers for unauthenticated requests
            return {
                'Content-Type': 'application/json',
                'User-Agent': navigator.userAgent || 'AppSync-Client/1.0',
                'Origin': window.location.origin
            };
        }
    },
};

// Log environment variables for debugging (with sensitive parts redacted)
console.log("Environment variables loaded:", {
    GRAPH_API_URL: import.meta.env.VITE_GRAPH_API_URL || "not set",
    USER_POOL_ID: import.meta.env.VITE_USER_POOL_ID ? "set (redacted)" : "not set",
    USER_POOL_CLIENT_ID: import.meta.env.VITE_USER_POOL_CLIENT_ID ? "set (redacted)" : "not set",
    IDENTITY_POOL_ID: import.meta.env.VITE_IDENTITY_POOL_ID ? "set (redacted)" : "not set",
    REGION: import.meta.env.VITE_REGION || "not set",
    STORAGE_BUCKET_NAME: import.meta.env.VITE_STORAGE_BUCKET_NAME || "not set"
});

// Use the environment variable for the AppSync URL
const graphApiUrl = import.meta.env.VITE_GRAPH_API_URL;

// Force diag log mode
const diagMode = true;
console.log("🔍 DIAGNOSTIC MODE ENABLED - checking for AppSync errors");

// Check if we have any API endpoints from CloudFormation outputs saved in localStorage
const savedEndpoints = localStorage.getItem('appSyncEndpoints');
if (savedEndpoints) {
  try {
    const endpoints = JSON.parse(savedEndpoints);
    console.log("✅ Found saved AppSync endpoints:", endpoints);
    if (endpoints.graphApiUrl) {
      console.log("📋 Using saved GraphQL URL:", endpoints.graphApiUrl);
    }
  } catch (e) {
    console.error("❌ Error parsing saved endpoints:", e);
  }
}

if (diagMode) {
  // Add event listeners to capture any AWS SDK errors
  window.addEventListener('error', function(event) {
    console.log('🛑 GLOBAL ERROR:', event.error);
    if (event.error && event.error.message && 
        (event.error.message.includes('AppSync') || 
         event.error.message.includes('GraphQL') || 
         event.error.message.includes('API'))) {
      console.error('🔴 AppSync API Error Detected:', event.error);
    }
  });

  // Debug AWS amplify config
  // Use type assertion to avoid TypeScript errors
  const windowWithAWS = window as any;
  if (windowWithAWS.AWS) {
    console.log('🔍 AWS SDK Config:', windowWithAWS.AWS.config);
  } else {
    console.log('⚠️ AWS SDK not found on window object');
  }
}

Amplify.configure(
    {
        Auth: {
            Cognito: {
                userPoolId: import.meta.env.VITE_USER_POOL_ID,
                userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
                identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
                allowGuestAccess: true, // Enable guest access for public resources
                // Removed Midway OAuth configuration
            },
        },
        API: {
            GraphQL: {
                endpoint: graphApiUrl,
                region: import.meta.env.VITE_REGION,
                // API Key is needed for unauthenticated access to AppSync WebSockets
                apiKey: import.meta.env.VITE_GRAPH_API_KEY || null,
                // Use userPool auth as default but allow API key for WebSockets
                defaultAuthMode: "userPool", // Use Cognito User Pool as default
            },
        },
        Storage: {
            S3: {
                region: import.meta.env.VITE_REGION,
                buckets: {
                    storageBucket: {
                        region: import.meta.env.VITE_REGION,
                        bucketName: import.meta.env.VITE_STORAGE_BUCKET_NAME,
                    },
                },
            },
        },
    },
    {
        API: {
            GraphQL: apiConfig,
        },
    }
);

// Log Amplify configuration (without sensitive data)
console.log("Amplify configured with GraphQL endpoint:", graphApiUrl);

export default function App() {
    const { authStatus } = useAuthenticator((context) => [context.authStatus]);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const prevAuthStatusRef = useRef(authStatus);
    
    // Track authentication state changes to handle transitions
    useEffect(() => {
        if (prevAuthStatusRef.current !== authStatus) {
            console.log(`Auth status changed: ${prevAuthStatusRef.current} -> ${authStatus}`);
            
            // Handle transition from authenticated to unauthenticated (sign-out)
            if (prevAuthStatusRef.current === "authenticated" && authStatus === "unauthenticated") {
                console.log("Sign-out detected - showing transition spinner");
                setIsTransitioning(true);
                
                // Clear transition state after a longer delay to ensure clean page transition
                const timer = setTimeout(() => {
                    setIsTransitioning(false);
                    // Force a window reload after sign-out to ensure a clean authentication state
                    // This prevents lingering subscriptions and auth errors
                    // Only do this if we're not already on the login page
                    if (window.location.pathname !== "/login") {
                        console.log("Redirecting to login page after sign-out");
                        window.location.href = "/";
                    }
                }, 1500);
                
                return () => clearTimeout(timer);
            } 
            // Handle other transitions (authenticated to authenticated, unauthenticated to authenticated)
            else if (prevAuthStatusRef.current === "authenticated" || prevAuthStatusRef.current === "unauthenticated") {
                setIsTransitioning(true);
                
                // Clear transition state after a delay to ensure router has time to update
                const timer = setTimeout(() => {
                    setIsTransitioning(false);
                }, 1000);
                
                return () => clearTimeout(timer);
            }
            
            // Also set transitioning if we just completed authentication
            if (authStatus === "authenticated" && prevAuthStatusRef.current === "configuring") {
                console.log("Auth completed - showing transition spinner to prevent blank screen");
                setIsTransitioning(true);
                
                const timer = setTimeout(() => {
                    setIsTransitioning(false);
                }, 500);
                
                return () => clearTimeout(timer);
            }
        }
        
        prevAuthStatusRef.current = authStatus;
    }, [authStatus]);

    // Common routes available to both authenticated and unauthenticated users
    const commonRoutes = [
        {
            path: "/simple-streaming",
            element: <SimpleStreamingDemo />,
            errorElement: <Error />,
        }
    ];

    // Routes for authenticated users
    const privateRoutes = [
        {
            path: "/",
            element: <Home />,
            errorElement: <Error />,
        },
        {
            path: "*",
            element: <NotFound />,
        },
        ...commonRoutes
    ];

    // Routes for unauthenticated users
    const publicRoutes = [
        {
            path: "/",
            element: <Login />,
            errorElement: <Error />,
        },
        {
            path: "*",
            element: <Login />,
        },
        ...commonRoutes
    ];

    // Create the router based on auth status
    const router = useMemo(() => {
        console.log(`Creating router with auth status: ${authStatus}`);
        return createBrowserRouter(authStatus === "authenticated" ? privateRoutes : publicRoutes);
    }, [authStatus]);

    // Render loading spinner during auth configuration or transitions
    if (authStatus === "configuring" || isTransitioning) {
        return (
            <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                height: "100vh",
                textAlign: "center"
            }}>
                <Spinner size="large" />
            </div>
        );
    }

    // Render the main application when authentication status is stable
    return (
        <I18nProvider locale={LOCALE} messages={[messages]}>
            <FlashbarProvider>
                <RouterProvider router={router} />
            </FlashbarProvider>
        </I18nProvider>
    );
}

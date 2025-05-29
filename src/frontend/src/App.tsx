import { useAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Spinner } from "@cloudscape-design/components";
import { I18nProvider } from "@cloudscape-design/components/i18n";
import messages from "@cloudscape-design/components/i18n/messages/all.en";
import "@cloudscape-design/global-styles/index.css";
import "./common/components/chat-bubble-fixes.css"; // Fix for chat bubble content truncation
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { FlashbarProvider } from "./common/contexts/Flashbar";
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
            return {
                Authorization: session.tokens?.idToken?.toString() ?? "",
            };
        } catch (error) {
            // Return empty headers for unauthenticated requests
            return {};
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

// Try to manually set the AppSync URL if it's missing or set to auto-discover
// Hard-code the AppSync URL for testing - the URL was broken in the configuration
const graphApiUrl = "https://YOUR-API-ID-HERE.appsync-api.YOUR-REGION-HERE.amazonaws.com/graphql";

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
                defaultAuthMode: "iam", // Allow API calls with IAM roles for unauthenticated access
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

    const router = createBrowserRouter(authStatus === "authenticated" ? privateRoutes : publicRoutes);

    // Load Cloudscape styles early to ensure they're available
    return (
        <div>
            {authStatus === "configuring" && <Spinner />}
            {(authStatus === "authenticated" || authStatus === "unauthenticated") && (
                <I18nProvider locale={LOCALE} messages={[messages]}>
                    <FlashbarProvider>
                        <RouterProvider router={router} />
                    </FlashbarProvider>
                </I18nProvider>
            )}
        </div>
    );
}

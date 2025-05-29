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
                endpoint: import.meta.env.VITE_GRAPH_API_URL,
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

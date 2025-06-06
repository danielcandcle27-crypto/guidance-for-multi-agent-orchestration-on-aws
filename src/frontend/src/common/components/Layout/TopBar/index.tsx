import { useAuthenticator } from "@aws-amplify/ui-react";
import { TopNavigation } from "@cloudscape-design/components";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { getCurrentUser } from "aws-amplify/auth";
import { useEffect, useState, useContext } from "react";
import { FlashbarContext } from "../../../contexts/Flashbar";
import { cleanupAllSubscriptions, setSigningOutState } from "../../../../utilities/authSubscriptionCleanup";
import Favicon from "./favicon.png";

const APP_NAME = "Multi-agent Collaboration";

interface AuthedUser {
    userName: string;
    userID: string;
}

const TopBar = () => {
    const [theme, setTheme] = useState<Mode>(() => {
        const savedTheme = localStorage.getItem("theme");
        return savedTheme === "dark" ? Mode.Dark : Mode.Light;
    });

    const { user, authStatus, signOut } = useAuthenticator((context) => [context.user]);
    const [authedUser, setAuthedUser] = useState<AuthedUser | null>(null);
    const { addFlashbarItem } = useContext(FlashbarContext);

    useEffect(() => {
        localStorage.setItem("theme", theme);
        applyMode(theme);
    }, [theme]);

    useEffect(() => {
        const currentAuthenticatedUser = async () => {
            try {
                // Only try to get user info if currently authenticated
                if (authStatus === "authenticated") {
                    if (!user) {
                        const { username, userId } = await getCurrentUser();
                        setAuthedUser({
                            userName: username,
                            userID: userId,
                        });
                    } else if (user.username) {
                        // Removed Midway-specific condition
                        setAuthedUser({
                            userName: user.username,
                            userID: user.userId,
                        });
                    } else {
                        setAuthedUser(null);
                    }
                } else {
                    // Clear user data when not authenticated
                    setAuthedUser(null);
                }
            } catch (error) {
                console.log("Authentication error:", error);
                setAuthedUser(null);
            }
            return null;
        };
        currentAuthenticatedUser();
    }, [authStatus, user]);

    return (
        <div
            style={{
                borderBottom:
                    theme === Mode.Dark
                        ? "2px solid var(--color-border-divider-default-cx07f2)"
                        : "none",
            }}
        >
            <TopNavigation
                identity={{
                    href: "/",
                    title: APP_NAME,
                    logo: {
                        src: Favicon,
                        alt: APP_NAME,
                    },
                }}
                utilities={[
                    {
                        type: "menu-dropdown",
                        iconName: "settings",
                        ariaLabel: "Settings",
                        title: "Settings",
                        onItemClick: ({ detail }) => {
                            if (detail.id === "switch-theme") {
                                setTheme(theme === Mode.Light ? Mode.Dark : Mode.Light);
                            }
                        },
                        items: [
                            {
                                id: "switch-theme",
                                text: theme === Mode.Light ? "🌑  Dark Theme" : "☀️ Light Theme",
                            },
                        ],
                    },
                    {
                        type: "menu-dropdown",
                        text: authedUser?.userName ?? "",
                        iconName: "user-profile",
                        items: [
                            {
                                id: "support-group",
                                text: "Support",
                                items: [
                                    {
                                        id: "documentation",
                                        text: "Documentation",
                                        href: "https://docs.aws.amazon.com/",
                                        external: true,
                                        externalIconAriaLabel: "(opens in new tab)",
                                    },
                                    {
                                        id: "feedback",
                                        text: "Feedback",
                                        href: "https://aws.amazon.com/contact-us/",
                                        external: true,
                                        externalIconAriaLabel: "(opens in new tab)",
                                    },
                                ],
                            },
                            { id: "signout", text: "Sign out" },
                        ],
                        onItemClick: async ({ detail }) => {
                            if (detail.id === "signout") {
                                try {
                                    // Set signing out state to prevent subscription errors
                                    setSigningOutState(true);
                                    
                                    // Clean up all active WebSocket subscriptions before signing out
                                    cleanupAllSubscriptions();
                                    
                                    // Then perform the sign out
                                    await signOut();
                                    
                                    // Reset the signing out state
                                    setSigningOutState(false);
                                } catch (error) {
                                    console.log("Failed to sign out: ", error);
                                    addFlashbarItem("error", "Sign out failed. Please try again.");
                                    // Reset signing out state in case of error
                                    setSigningOutState(false);
                                }
                            }
                        },
                    },
                ]}
            />
        </div>
    );
};

export default TopBar;

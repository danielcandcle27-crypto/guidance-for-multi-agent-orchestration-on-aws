import { SideNavigation } from "../components/cloudscape-imports";
// router
import { useLocation, useNavigate, Routes, Route } from "react-router-dom";
import { NavigationEvent } from "../types/navigation";
import { Overview } from "./Overview";
import Chatbot from "./Chatbot";
import { appName } from "../atoms/AppAtoms";
import { History } from "./History";
import { HistoryPanel } from "./HistoryPanel";
import Documents from "./Documents";

export const AppRoutes = {
    home: {
        text: "Home",
        href: "/"
    },
    overview: {
        text: "Overview",
        href: "/Overview",
    },
    history: {
        text: "History",
        href: "/history",
    }
}


export const AppSideNavigation = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <SideNavigation
            header={{ href: "/", text: appName }}
            activeHref={location.pathname}
            onFollow={(event: NavigationEvent) => {
                if (!event.detail.external) {
                    event.preventDefault();
                    navigate(event.detail.href);
                }
            }}
            items={[
                { type: "link", text: AppRoutes.overview.text, href: AppRoutes.overview.href },
                { type: "link", text: "Chatbot", href: "/chatbot" },
                { type: "divider" },
                { type: "link", text: "Gitlab", href: "https://gitlab.aws.dev/genai-labs/demo-assets/mac-demo-customer-support", external: true },
                { type: "link", text: "Documentation", href: "https://docs.aws.amazon.com/bedrock/latest/userguide/agents-multi-agent-collaboration.html", external: true },
                { type: "divider" },
                { type: "link", text: "Version 1.0", href: "#" }
            ]}
        />

    );
};


export const PageContent = () => {
    const location = useLocation();
    return (
        <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route path={AppRoutes.history.href} element={<History />} />
            <Route path="/data" element={<Documents />} />
            <Route path={AppRoutes.overview.href} element={<Overview />} />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route path="/" element={<Overview />} />
            <Route path="*" element={<Overview />} />
        </Routes>
    )
}

export const InfoContent = () => {
    return (
        <Routes>
            <Route path={AppRoutes.overview.href} element={<Overview />} />
            <Route path="*" element={<HistoryPanel />} />
        </Routes>)
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useState } from "react";
import { ToastContainer, Slide } from "react-toastify";
import { infoDrawerAtom, navDrawerAtom, themeAtom } from "../atoms/AppAtoms";
import TopBar from "../components/TopBar";
import { BrowserRouter, Routes, Route } from "react-router-dom"; // Import Routes and Route
import I18nProvider from "@cloudscape-design/components/i18n";
import messages from "@cloudscape-design/components/i18n/messages/all.all";
import { AppLayout } from "../components/cloudscape-imports";
import '../styles/layout.css';
import { PageContent, InfoContent, AppSideNavigation } from "./PageNavigation";
import { applyMode } from "@cloudscape-design/global-styles";

const LOCALE = "en";
const appLayoutLabels = {
  navigation: "Side navigation",
  navigationToggle: "Open side navigation",
  navigationClose: "Close side navigation",
  notifications: "Notifications",
  tools: "Help panel",
  toolsToggle: "Open help panel",
  toolsClose: "Close help panel",
};

export const AppBase = () => {
  // Create a client
  const queryClient = new QueryClient();
  // atoms
  const [theme] = useAtom(themeAtom);
  const [navDrawer, setNavDrawer] = useAtom(navDrawerAtom);
  const [infoDrawer, setInfoDrawer] = useAtom(infoDrawerAtom);

  // theme control
  applyMode(theme);

  const [navigationOpen, setNavigationOpen] = useState(true);

  return (
    <BrowserRouter basename="/">
      <QueryClientProvider client={queryClient}>
        <I18nProvider locale={LOCALE} messages={[messages]}>
          <ToastContainer
            position="bottom-left"
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss={false}
            draggable
            pauseOnHover
            theme={theme}
            transition={Slide}
          />
          <TopBar />
          <AppLayout
            navigation={<AppSideNavigation />}
            navigationOpen={navigationOpen}
            onNavigationChange={({ detail }: { detail: { open: boolean } }) => setNavigationOpen(detail.open)}
            navigationWidth={300}
            content={<PageContent />}
            ariaLabels={appLayoutLabels}
            toolsHide={true}
          />
        </I18nProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

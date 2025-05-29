import { Tabs } from "@cloudscape-design/components";
import Layout from "../../common/components/Layout";
import Chat from "./Chat";
import DataTabs from "./Data";
import { useState } from "react";

const Home = () => {
    // State to track whether the Data tab should be disabled
    const [isDataTabDisabled, setIsDataTabDisabled] = useState(false);
    return (
        <Layout
            content={
                <Tabs
                    tabs={[
                        {
                            label: "Chat",
                            id: "chat",
                            content: <Chat onLoadingStateChange={setIsDataTabDisabled} />,
                        },
                        {
                            label: "Data",
                            id: "data",
                            content: <DataTabs />,
                            disabled: isDataTabDisabled
                        },
                    ]}
                />
            }
        />
    );
};

export default Home;

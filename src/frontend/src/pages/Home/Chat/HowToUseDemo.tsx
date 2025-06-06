import React from "react";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";

const HowToUseDemo: React.FC = () => {
  return (
    <Container
      header={<Header variant="h3">How to use this demo</Header>}
      variant="stacked"
    >
      <Box >
        <p>Just pick a sample question from the chat to kick things off.</p>
        <p>You'll see how the agents work together in the flowchart on the right. Select the dropdowns, or agent nodes in the flowchart to view the agent traces.</p>
        <p>When it's done, feel free to try out another one—or check out the Data tab to further review information that each agent has access to.</p>
      </Box>
    </Container>
  );
};

export default HowToUseDemo;

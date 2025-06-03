import React from "react";
import SupportPromptGroup from "@cloudscape-design/chat-components/support-prompt-group";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";

interface SampleQuestionsProps {
  onQuestionClick: (text: string) => void;
}

const SampleQuestions: React.FC<SampleQuestionsProps> = ({ onQuestionClick }) => {
  // Same predefined messages from QuickLinks with their original titles
  const sampleQuestions = [
    {
      id: "product-recommendations",
      title: "Product Inquiry & Customer Feedback",
      text: "I like expensive, good quality phones. What is the best phone you have, and what are the comments that people say about this product? - Logged in as cust010 (new request)",
    },
    {
      id: "customer-preference",
      title: "Recommendation & Troubleshoot",
      text: "I'm really interested in watches. Let me know what you have that you think i'd like. Make sure to let me know of any known issues and warranty information too. - Logged in as cust002 (new request)",
    },
    {
      id: "troubleshoot-watch",
      title: "Order Mgmt & Recommendation",
      text: "I ordered a promax laptop, and would like to know if it has been delivered yet. I also have been looking through some of your phones online. Recommend me a phone i'd like. - Logged in as cust005 (new request)",
    },
    {
      id: "recommendation-faq",
      title: "Recommendation & FAQ",
      text: "Are there any available speakers in stock that I would like? And in case I run into issues with the product, give me some troubleshooting tips for the products. - Logged in as cust007 (new request)",
    }
  ];

  return (
    <Container
      header={<Header variant="h3">Sample Questions</Header>}
      variant="stacked"
    >
      <Box padding="s">
        {/* Create individual SupportPromptGroup components for each question to make them display horizontally */}
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", gap: "10px" }}>
          {sampleQuestions.map((question) => (
            <div key={question.id} style={{ flex: "1 1 0" }}>
              <SupportPromptGroup
                items={[{
                  id: question.id,
                  text: question.title
                }]}
                onItemClick={() => onQuestionClick(question.text)}
                ariaLabel={`Sample question: ${question.title}`}
              />
            </div>
          ))}
        </div>
      </Box>
    </Container>
  );
};

export default SampleQuestions;

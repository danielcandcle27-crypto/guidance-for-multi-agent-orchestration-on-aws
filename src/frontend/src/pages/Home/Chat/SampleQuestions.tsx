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
      text: "I like good quality nova phones. Provide me a product suggestion, followed up with comments people say about it? - customer id cust010 (new request)",
    },
    {
      id: "customer-preference",
      title: "Recommendation & Troubleshoot",
      text: "I'm really interested in smart type watches. I dont care about cost. Let me know what you have that you think i'd like. Make sure to let me know of any known issues and warranty information too. - customer id cust002 (new request)",
    },
    {
      id: "troubleshoot-watch",
      title: "Order Mgmt & Recommendation",
      text: "I ordered a promax laptop, and would like to know if it has been delivered yet. I also have been looking through some of your phones online. Recommend me a phone i'd like. - customer id cust005 (new request)",
    },
    {
      id: "recommendation-faq",
      title: "Recommendation & FAQ",
      text: "Are there any available speakers in stock that I would like under $100? And in case I run into issues with the product, give me some troubleshooting tips for the products. - customer id cust007 (new request)",
    }
  ];

  return (
    <div style={{ padding: "0.5rem" }}>
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
    </div>
  );
};

export default SampleQuestions;

import React from "react";
import { Box, Link } from "@cloudscape-design/components";

interface QuickLinksProps {
  onLinkClick: (text: string) => void;
}

const QuickLinks: React.FC<QuickLinksProps> = ({ onLinkClick }) => {
  // Predefined messages
  const quickMessages = [
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
    <Box padding="s" textAlign="center">
      <div style={{ 
        display: "flex", 
        justifyContent: "space-evenly", 
        alignItems: "center", 
        width: "100%" 
      }}>
        {quickMessages.map((message) => (
          <Link
            key={message.id}
            href="#"
            onFollow={(event) => {
              event.preventDefault();
              onLinkClick(message.text);
            }}
          >
            {message.title}
          </Link>
        ))}
      </div>
    </Box>
  );
};

export default QuickLinks;
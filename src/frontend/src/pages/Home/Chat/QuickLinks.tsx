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
      title: "Product Recommendations",
      text: "I've been looking at your headphones and speakers products, and what's in stock. Give me some recommendations that you think i'd like. - Logged in as cust010 (new request)",
    },
    {
      id: "customer-preference",
      title: "Customer Preference",
      text: "I'm really interested in watches. Let me know what you have that you think i'd like. Make sure to let me know of any known issues and warranty information too. - Logged in as cust002 (new request)",
    },
    {
      id: "troubleshoot-watch",
      title: "Troubleshoot Watch",
      text: "My Vitafit smartwatch screen stopped responding suddenly, even though the battery is fully charged. I tried restarting it, but the issue persists. Help me troubleshoot. After, recommend me other watches you think I would like. - Logged in as cust005 (new request)",
    },
    {
      id: "recommendation-faq",
      title: "Recommendation & FAQ",
      text: "I like speakers alot. Are there any available products in stock that match my preference? And in case I run into issues with the product, give me some troubleshooting tips for the products. - Logged in as cust007 (new request)",
    },
    {
      id: "recommendation-product-inquiry",
      title: "Recommendation & Product Inquiry",
      text: "I want to know of any products that have not been returned. Also, provide feedback customers had for these products.  - Logged in as cust004 (new request)",
    },
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
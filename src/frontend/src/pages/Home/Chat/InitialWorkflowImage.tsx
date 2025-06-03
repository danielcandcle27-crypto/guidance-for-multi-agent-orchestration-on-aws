import React from "react";

interface InitialWorkflowImageProps {
  avatar?: React.ReactNode;
}

const InitialWorkflowImage: React.FC<InitialWorkflowImageProps> = () => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      width: '100%', 
      padding: '2rem 0'
    }}>
      <img 
        src="/images/ai_image.png" 
        alt="Agentic Workflow Diagram" 
        style={{ 
          maxWidth: '90%',
          maxHeight: '380px',
          borderRadius: '6px'
        }} 
      />
    </div>
  );
};

export default InitialWorkflowImage;

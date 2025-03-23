import { Box, Header } from "../components/cloudscape-imports";
import { useEffect, useRef } from "react";

const Workflow = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Ensure video plays on mount and handle autoplay
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.error("Error attempting to play video:", error);
      });
    }
  }, []);

  return (
    <Box padding="l">
      <Header 
        variant="h1"
        description="Visual demonstration of the multi-agent collaboration process"
      >
        Multi-Agent Collaboration Workflow for Customer Support Assistant
      </Header>
      <Box padding={{ vertical: "l" }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <img 
            src="/clips/workflow_clip.gif" 
            alt="Workflow Animation"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          />
        </div>
      </Box>
    </Box>
  );
};

export default Workflow;

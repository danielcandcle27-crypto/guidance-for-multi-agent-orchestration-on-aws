// src/pages/Overview.tsx
import React, { useState } from 'react';
import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';

export const Overview: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Box padding={{ top: 'l', bottom: 'l' }}>
      <SpaceBetween size="l">
        {/* Overview Section */}
        <Header variant="h1" className="header-modern">
          Overview
        </Header>

        {/* Why Multi-Agent Collaboration? */}
        <Container
          header={
            <Header
              variant="h1"
              description="Amazon Bedrock's multi-agent collaboration allows developers to create networks of specialized agents that tackle specific tasks under a supervisor agent's guidance, enhancing efficiency and accuracy. In the case of a large retailer facing growing customer support demands, Bedrock enables the deployment of multiple AI-powered agents—each skilled in areas like order management, troubleshooting, and personalized recommendations. This setup not only improves response times and accuracy but also scales effectively to meet increasing demands, ensuring a superior customer experience."
            >
              Why Multi-Agent Collaboration?
            </Header>
          }
        />

        {/* Click-through Demo Section */}
        <Container
          header={
            <Header variant="h2" description="Watch our demo video to see the platform in action.">
              Video on Service & Use Case
            </Header>
          }
        >
          <Box padding="l">
            <img
              src="/clips/clickthrough_demo.gif"
              alt="Click-through Demo"
              style={{
                width: '100%',
                maxWidth: '1000px',
                margin: '0 auto',
                display: 'block',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
              }}
            />
          </Box>
        </Container>

        {/* Architecture Diagram Section */}
        <Container
          header={
            <Header variant="h2" description="Explore the architecture behind this system.">
              System Architecture
            </Header>
          }
        >
          <Box textAlign="center" padding="l">
            <img
              src="../images/arch_diagram2.png"
              alt="Architecture Diagram"
              style={{
                maxWidth: '90%',
                background: 'var(--color-surface)',
                width: '1000px',
                height: 'auto',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                animation: 'fadeIn var(--transition-normal)',
              }}
            />
          </Box>
        </Container>

        {/* Overview Video Section */}
        <Container
          header={
            <Header variant="h2" description="Watch the overview video to learn more.">
              Overview Video
            </Header>
          }
        >
          <Box textAlign="center" padding="l">
            <a
              href="https://www.youtube.com/watch?v=tMqTy1HR974"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', position: 'relative' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
            >
              <img
                src="https://img.youtube.com/vi/tMqTy1HR974/0.jpg"
                alt="YouTube Thumbnail"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  transform: 'translateY(0)',
                  transition: 'all var(--transition-normal)',
                  cursor: 'pointer',
                }}
              />
            </a>
          </Box>
        </Container>
      </SpaceBetween>
    </Box>
  );
};

import * as React from "react";
import Drawer from "@cloudscape-design/components/drawer";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Header from "@cloudscape-design/components/header";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Badge from "@cloudscape-design/components/badge";
import Button from "@cloudscape-design/components/button";
import { Spinner, Alert } from "@cloudscape-design/components";
import { MessagePair } from "./chatHistoryService";

interface MessageHistoryDrawerProps {
  messagePairs: MessagePair[];
  visible?: boolean;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const MessageHistoryDrawer: React.FC<MessageHistoryDrawerProps> = ({ 
  messagePairs,
  visible = false,
  loading = false,
  error = null,
  onRefresh
}) => {
  // Only render the drawer if it's visible
  if (!visible) return null;
  
  return (
    <div className="message-history-drawer" style={{
      position: 'fixed',
      top: '60px',
      right: '0',
      width: '350px',
      height: 'calc(100vh - 60px)',
      zIndex: 1000,
      backgroundColor: 'white',
      boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.1)',
      overflowY: 'auto'
    }}>
      <Drawer header={
        <Header variant="h2" 
          description="Last 10 conversations" 
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Badge color="blue">{messagePairs.length} conversations</Badge>
              {onRefresh && (
                <Button 
                  iconName="refresh" 
                  variant="icon" 
                  onClick={onRefresh} 
                  disabled={loading}
                  ariaLabel="Refresh chat history"
                />
              )}
            </SpaceBetween>
          }
        >
          Message History
        </Header>
      }>
        <Box margin={{ bottom: "l" }}>
          {loading ? (
            <Box textAlign="center" padding="l">
              <Spinner size="large" />
              <Box variant="p" padding={{ top: "s" }}>
                Loading chat history from DynamoDB...
              </Box>
            </Box>
          ) : error ? (
            <Box padding="m">
              <Alert
                type="error"
                header="Error loading chat history"
                action={onRefresh ? "Retry" : undefined}
                onDismiss={onRefresh}
              >
                {error}
              </Alert>
            </Box>
          ) : (
            <SpaceBetween size="xl">
              {messagePairs.map((pair, index) => (
                <SpaceBetween key={`pair-${index}`} size="xs">
                  <Header variant="h3">
                    {pair.date} - {pair.time}
                  </Header>
                  <ExpandableSection
                    headerText="Conversation"
                    defaultExpanded={index === 0}
                  >
                    <KeyValuePairs
                      columns={1}
                      items={[
                        { 
                          label: "You", 
                          value: typeof pair.user.content === "string" 
                            ? pair.user.content 
                            : "Content not available" 
                        },
                        {
                          label: "Assistant",
                          value: typeof pair.assistant.content === "string" 
                            ? pair.assistant.content 
                            : "Content not available"
                        }
                      ]}
                    />
                  </ExpandableSection>
                </SpaceBetween>
              ))}
              {messagePairs.length === 0 && !loading && !error && (
              <Box color="text-status-inactive" textAlign="center" padding="m">
                <SpaceBetween size="s">
                  <div>No conversation history found</div>
                  {onRefresh && (
                    <Button 
                      onClick={onRefresh} 
                      iconName="refresh"
                      disabled={loading}
                    >
                      Refresh History
                    </Button>
                  )}
                </SpaceBetween>
              </Box>
              )}
            </SpaceBetween>
          )}
        </Box>
      </Drawer>
    </div>
  );
};

export default MessageHistoryDrawer;

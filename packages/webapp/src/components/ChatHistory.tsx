import React from 'react';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import HistoryPanel from './HistoryPanel';
import '../styles/chatbot-layout.css';
import '../styles/chat-history.css';

const ChatHistory: React.FC = () => {
  
  
  return (
    <div className="chat-history-panel animate-fade-in">
      <ExpandableSection 
        headerText="Chat History (Last 10 entries)"
        className="chat-history-header"
        variant="container"
        defaultExpanded={false}  // Start with history closed
      >
        <div className="chat-history-content">
          <HistoryPanel 
            style={{ 
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '10px',
              width: '100%',
              display: 'block'
            }} 
          />
        </div>
      </ExpandableSection>
      <style>{`
        .chat-history-panel {
          margin-top: 20px;
          border: 1px solid var(--color-border-divider-default);
          border-radius: 4px;
          background: var(--color-background-container-content);
        }
        .chat-history-content {
          padding: 0;
          margin: 0;
        }
        .history-entry {
          border-bottom: 1px solid var(--color-border-divider-default);
          padding: 16px;
          margin: 0;
        }
        .history-entry:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
};

export default ChatHistory;
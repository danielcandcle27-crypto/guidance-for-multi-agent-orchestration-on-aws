import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import { chatHistoryAtom, loadChatHistory, ChatHistoryEntry } from '../atoms/ChatHistoryAtom';
import '../styles/chatbot-layout.css';

interface HistoryPanelProps {
  style?: React.CSSProperties;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ style = {} }) => {
  // Combine passed styles with defaults
  const combinedStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-background-container-content)',
    color: 'var(--color-text-body-default)',
    ...style
  };

  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);

  // Validate and clean history entry
  const validateEntry = (entry: ChatHistoryEntry): ChatHistoryEntry | null => {
    if (!entry || typeof entry !== 'object') {
      console.error('Invalid history entry:', entry);
      return null;
    }

    

    if (typeof entry.prompt !== 'string' || !entry.prompt.trim()) {
      console.error('Invalid prompt in entry:', entry);
      return null;
    }

    if (typeof entry.response !== 'string') {
      console.error('Invalid response in entry:', entry);
      return null;
    }

    return {
      prompt: entry.prompt.trim(),
      response: entry.response.trim(),
      timestamp: entry.timestamp || Date.now(),
      entryNumber: entry.entryNumber
    };
  };

  // Load history initially and when explicitly triggered
  useEffect(() => {
    // Load on mount
    const history = loadChatHistory();
    if (history && Array.isArray(history)) {
      const currentHistoryStr = JSON.stringify(chatHistory);
      const latestHistoryStr = JSON.stringify(history);
      if (currentHistoryStr !== latestHistoryStr) {
        if (process.env.NODE_ENV === 'development') {
          
        }
        setChatHistory(history);
      }
    }

    // Set up event listener for manual refresh
    const refreshListener = () => reloadHistory();
    window.addEventListener('chatHistoryRefresh', refreshListener);
    
    return () => {
      window.removeEventListener('chatHistoryRefresh', refreshListener);
    };
  }, []); // Only run on mount

  // Manual reload when needed
  const reloadHistory = () => {
    const latestHistory = loadChatHistory();
    if (latestHistory.length > 0) {
      
      setChatHistory(latestHistory);
    }
  };

  // Debug log whenever history changes (removed periodic reload to prevent loops)
  useEffect(() => {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      
    }
  }, []);

  return (
    <Box padding="m" className="history-panel-box">
      {/* Wrap the content in a <div> so we can apply inline styles */}
      <div style={combinedStyle}>
        <SpaceBetween size="l">
          {chatHistory?.length > 0 ? (
            [...chatHistory].reverse().map((entry: ChatHistoryEntry, index: number) => {
              const validEntry = validateEntry(entry);
              if (!validEntry) {
                return null;
              }
              
              return (
                <div key={validEntry.timestamp} className="history-entry animate-fade-in">
                  <div className="entry-header">
                    <span className="entry-number">
                      #{validEntry.entryNumber || chatHistory.length - index} -{' '}
                      {new Date(validEntry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h4 style={{ color: '#4b8cf5', margin: '8px 0' }}>Prompt:</h4>
                  <p
                    style={{
                      whiteSpace: 'pre-wrap',
                      minHeight: '1.2em',
                      display: 'block',
                      padding: '8px',
                      margin: '4px 0',
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: '4px',
                      color: '#333',
                      wordBreak: 'break-word'
                    }}
                  >
                    {validEntry.prompt}
                  </p>
                  <h4 style={{ color: '#28a745', margin: '8px 0' }}>Response:</h4>
                  <p
                    style={{
                      whiteSpace: 'pre-wrap',
                      minHeight: '1.2em',
                      display: 'block',
                      padding: '8px',
                      margin: '4px 0',
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: '4px',
                      color: '#333',
                      wordBreak: 'break-word'
                    }}
                  >
                    {validEntry.response ? validEntry.response : '[no response]'}
                  </p>
                  <hr className="entry-separator" />
                </div>
              );
            })
          ) : (
            <div>No chat history available</div>
          )}
        </SpaceBetween>
      </div>
    </Box>
  );
};

export default HistoryPanel;

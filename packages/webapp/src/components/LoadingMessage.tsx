import React from 'react';
import '../styles/loading-message.css'; // optional styling file

interface LoadingMessageProps {
  currentTrace?: string;
  currentSubTrace?: string;
}

export const LoadingMessage: React.FC<LoadingMessageProps> = ({
  currentTrace,
  currentSubTrace
}) => {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <div className="loading-text">
        Thinking...
        {currentTrace && (
          <div className="loading-trace">
            <strong>{currentTrace}</strong>
            {currentSubTrace && ` → ${currentSubTrace}`}
          </div>
        )}
      </div>
    </div>
  );
};

// src/pages/HistoryPanel.tsx
import React from 'react';
// Import HelpPanel directly from Cloudscape:
import HelpPanel from '@cloudscape-design/components/help-panel';

export const HistoryPanel = () => {
  return (
    <HelpPanel
      header={<h2>History Page</h2>}
    >
      <div>
        View execution history listed by a unique execution ID. Each execution shows:
        <ul>
          <li>Selected image</li>
          <li>Final attributes list item</li>
          <li>Brand voice messaging</li>
          <li>Generated product description</li>
        </ul>
      </div>
    </HelpPanel>
  );
};

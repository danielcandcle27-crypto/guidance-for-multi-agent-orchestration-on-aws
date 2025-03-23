// src/pages/Documents.tsx

import React, { useEffect, useState } from 'react';

// Cloudscape imports
import Box from '@cloudscape-design/components/box';
import Tabs from '@cloudscape-design/components/tabs';

import ErrorBoundary from '../components/ErrorBoundary';
import OrderManagementTable from '../components/OrderManagementTable';
import PersonalizationTable from '../components/PersonalizationTable';
import ProdRecTable from '../components/ProdRecTable';
import TroubleshootTable from '../components/TroubleshootTable';

const OrderManagementContent = () => {
  console.log('%c OrderManagementContent rendering', 'background: #222; color: #bada55');
  return (
    <ErrorBoundary>
      <Box padding={{ vertical: 'l' }}>
        <OrderManagementTable />
      </Box>
    </ErrorBoundary>
  );
};

const PersonalizationContent = () => {
  const [key, setKey] = useState(0);
  console.log('%c PersonalizationContent rendering', 'background: #222; color: #bada55');

  useEffect(() => {
    setKey((prev) => prev + 1); // Force a remount
  }, []);

  return (
    <ErrorBoundary>
      <Box padding={{ vertical: 'l' }}>
        <PersonalizationTable key={key} />
      </Box>
    </ErrorBoundary>
  );
};

const ProdRecContent = () => {
  const [key, setKey] = useState(0);
  console.log('%c Product Recommendation rendering', 'background: #222; color: #bada55');

  useEffect(() => {
    setKey((prev) => prev + 1); // Force a remount
  }, []);

  return (
    <ErrorBoundary>
      <Box padding={{ vertical: 'l' }}>
        <ProdRecTable key={key} />
      </Box>
    </ErrorBoundary>
  );
};

const TroubleshootContent = () => {
  const [key, setKey] = useState(0);
  console.log('%c Troubleshoot rendering', 'background: #222; color: #bada55');

  useEffect(() => {
    setKey((prev) => prev + 1); // Force a remount
  }, []);

  return (
    <ErrorBoundary>
      <Box padding={{ vertical: 'l' }}>
        <TroubleshootTable key={key} />
      </Box>
    </ErrorBoundary>
  );
};

const Documents: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState('order_management');

  useEffect(() => {
    console.log('Documents mounted, initial activeTabId:', activeTabId);
  }, []);

  console.log('Documents rendering, activeTabId:', activeTabId);

  return (
    <Box padding="l">
      <Tabs
        activeTabId={activeTabId}
        onChange={({ detail }) => {
          console.log('Tab changed to:', detail.activeTabId);
          setActiveTabId(detail.activeTabId);
        }}
        tabs={[
          {
            id: 'order_management',
            label: 'Order Management Data',
            content: <OrderManagementContent />,
          },
          {
            id: 'personalization',
            label: 'Personalization Data',
            content: <PersonalizationContent />,
          },
          {
            id: 'prod_recommendation',
            label: 'Product Recommendation Data',
            content: <ProdRecContent />,
          },
          {
            id: 'troubleshoot',
            label: 'Troubleshoot Data',
            content: <TroubleshootContent />,
          },
        ]}
      />
    </Box>
  );
};

export default Documents;

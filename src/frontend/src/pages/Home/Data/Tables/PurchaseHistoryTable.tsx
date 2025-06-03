import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Spinner, Box, Alert, Button } from '@cloudscape-design/components';
import BaseTable from './BaseTable';
import { fetchPurchaseHistory } from '../api';
import { FlashbarContext } from '../../../../common/contexts/Flashbar';

// Storage key for tracking fetch attempts
const PURCHASE_HISTORY_FETCH_ATTEMPT_KEY = 'purchase_history_fetch_attempted';

const PurchaseHistoryTable: React.FC = () => {
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addFlashbarItem } = useContext(FlashbarContext);
  
  // Load data function defined with useCallback to prevent recreation on each render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Log attempt to fetch purchase history
      console.log("Attempting to fetch purchase history data");
      
      const data = await fetchPurchaseHistory();
      
      // Log successful fetch
      console.log("Successfully loaded purchase history data:", data.length, "records");
      
      setPurchaseHistory(data);
      
      // Successfully loaded data, remove the fetch attempt marker
      localStorage.removeItem(PURCHASE_HISTORY_FETCH_ATTEMPT_KEY);
      
    } catch (error) {
      console.error("Error loading purchase history data:", error);
      const errorMessage = error instanceof Error ? 
        `Failed to load purchase history data: ${error.message}` :
        'Failed to load purchase history data. Please try again.';
      
      setError(errorMessage);
      addFlashbarItem("error", errorMessage);
      
      // Mark that we attempted a fetch but failed
      localStorage.setItem(PURCHASE_HISTORY_FETCH_ATTEMPT_KEY, 'true');
    } finally {
      setLoading(false);
    }
  }, [addFlashbarItem]);

  // Reset fetch attempt function
  const resetFetchAttempt = useCallback(() => {
    localStorage.removeItem(PURCHASE_HISTORY_FETCH_ATTEMPT_KEY);
    loadData(); // Directly call loadData instead of setting state that triggers useEffect
  }, [loadData]);

  // Initial data loading on component mount - only runs once
  useEffect(() => {
    loadData();
    
    // If there was a previous failed attempt, clear it
    if (localStorage.getItem(PURCHASE_HISTORY_FETCH_ATTEMPT_KEY) === 'true') {
      console.log("Clearing previous fetch attempt marker to enable retry");
      localStorage.removeItem(PURCHASE_HISTORY_FETCH_ATTEMPT_KEY);
    }
  }, [loadData]); // Only depends on the stable loadData function

  const columnDefinitions = [
    {
      id: "customer_id",
      header: "Customer ID",
      cell: item => item.customer_id,
      sortingField: "customer_id"
    },
    {
      id: "product_id",
      header: "Product ID",
      cell: item => item.product_id,
      sortingField: "product_id"
    },
    {
      id: "purchase_date",
      header: "Purchase Date",
      cell: item => item.purchase_date,
      sortingField: "purchase_date"
    },
    {
      id: "quantity",
      header: "Quantity",
      cell: item => item.quantity,
      sortingField: "quantity"
    },
    {
      id: "purchase_amount",
      header: "Purchase Amount",
      cell: item => `$${item.purchase_amount}`,
      sortingField: "purchase_amount"
    },
    {
      id: "payment_method",
      header: "Payment Method",
      cell: item => item.payment_method,
      sortingField: "payment_method"
    }
  ];

  // Define filtering properties for the property filter
  const filteringProperties = [
    {
      propertyKey: "payment_method",
      filteringOption: {
        key: "payment_method",
        value: "payment_method",
        operator: "=",
      }
    },
    {
      propertyKey: "customer_id",
      filteringOption: {
        key: "customer_id",
        value: "customer_id",
        operator: "=",
      }
    }
  ];

  if (loading) {
    return (
      <Box textAlign="center" padding="l">
        <Spinner size="large" />
        <Box variant="p" padding={{ top: "s" }}>
          Loading purchase history data...
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="l">
        <Alert type="error" header="Error loading purchase history data">
          {error}
          <Box padding={{ top: "m" }}>
            <Button onClick={resetFetchAttempt}>Retry</Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <BaseTable
      title="Purchase History"
      columnDefinitions={columnDefinitions}
      items={purchaseHistory}
      filteringProperties={filteringProperties}
    />
  );
};

export default PurchaseHistoryTable;

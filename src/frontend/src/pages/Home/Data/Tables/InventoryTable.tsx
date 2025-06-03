import React, { useState, useEffect, useContext } from 'react';
import { StatusIndicator, StatusIndicatorProps, Spinner, Box, Alert, Button } from '@cloudscape-design/components';
import BaseTable from './BaseTable';
import { fetchInventory } from '../api';
import { FlashbarContext } from '../../../../common/contexts/Flashbar';

// Storage key for tracking fetch attempts
const INVENTORY_FETCH_ATTEMPT_KEY = 'inventory_fetch_attempted';

const InventoryTable: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track if a fetch has already been attempted to prevent infinite retries
  const [fetchAttempted, setFetchAttempted] = useState<boolean>(() => {
    return localStorage.getItem(INVENTORY_FETCH_ATTEMPT_KEY) === 'true';
  });
  const { addFlashbarItem } = useContext(FlashbarContext);

  // Function to reset the fetch attempt state
  const resetFetchAttempt = () => {
    localStorage.removeItem(INVENTORY_FETCH_ATTEMPT_KEY);
    setFetchAttempted(false);
    setLoading(true);
    setError(null);
  };

  useEffect(() => {
    // Only attempt to load data if we haven't already tried
    if (!fetchAttempted) {
      const loadData = async () => {
        try {
          setLoading(true);
          setError(null);
          // Mark that we're attempting a fetch
          localStorage.setItem(INVENTORY_FETCH_ATTEMPT_KEY, 'true');
          setFetchAttempted(true);
          
          const data = await fetchInventory();
          setInventory(data);
          // If successful, we can clear the fetch attempt marker
          localStorage.removeItem(INVENTORY_FETCH_ATTEMPT_KEY);
        } catch (error) {
          console.error("Error loading inventory data:", error);
          const errorMessage = error instanceof Error ? 
            `Failed to load inventory data: ${error.message}` :
            'Failed to load inventory data. Please try again.';
          
          setError(errorMessage);
          addFlashbarItem("error", errorMessage);
        } finally {
          setLoading(false);
        }
      };

      loadData();
    } else {
      // If we've already attempted a fetch and it likely failed, don't try again automatically
      setLoading(false);
    }
  }, [addFlashbarItem, fetchAttempted]);

  const columnDefinitions = [
    {
      id: "product_id",
      header: "Product ID",
      cell: item => item.item_id,
      sortingField: "item_id"
    },
    {
      id: "product_name",
      header: "Product Name",
      cell: item => item.product_name,
      sortingField: "product_name"
    },
    {
      id: "category",
      header: "Category",
      cell: item => item.category,
      sortingField: "category"
    },
    {
      id: "quantity",
      header: "Quantity",
      cell: item => item.quantity_in_stock,
      sortingField: "quantity_in_stock"
    },
    {
      id: "in_stock",
      header: "In Stock",
      cell: item => {
        const isInStock = item.quantity_in_stock > 0;
        return <StatusIndicator type={isInStock ? "success" : "error"}>
          {isInStock ? "Yes" : "No"}
        </StatusIndicator>;
      },
      sortingField: "quantity_in_stock"
    },
    {
      id: "reorder_threshold",
      header: "Reorder Threshold",
      cell: item => item.reorder_threshold,
      sortingField: "reorder_threshold"
    },
    {
      id: "quantity_on_order",
      header: "Quantity On Order",
      cell: item => item.quantity_on_order,
      sortingField: "quantity_on_order"
    },
    {
      id: "last_restock_date",
      header: "Last Restock Date",
      cell: item => item.last_restock_date,
      sortingField: "last_restock_date"
    },
  ];

  // Define filtering properties for the property filter
  const filteringProperties = [
    {
      propertyKey: "category",
      filteringOption: {
        key: "category",
        value: "category",
        operator: "=",
      }
    },
    {
      propertyKey: "quantity_in_stock",
      filteringOption: {
        key: "quantity_in_stock",
        value: "quantity_in_stock",
        operator: ">",
      }
    },
  ];

  if (loading) {
    return (
      <Box textAlign="center" padding="l">
        <Spinner size="large" />
        <Box variant="p" padding={{ top: "s" }}>
          Loading inventory data...
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="l">
        <Alert type="error" header="Error loading inventory data">
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
      title="Product Inventory"
      columnDefinitions={columnDefinitions}
      items={inventory}
      filteringProperties={filteringProperties}
    />
  );
};

export default InventoryTable;

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { StatusIndicator, StatusIndicatorProps, Spinner, Box, Alert, Button } from '@cloudscape-design/components';
import BaseTable from './BaseTable';
import { fetchOrders } from '../api';
import { FlashbarContext } from '../../../../common/contexts/Flashbar';

// Storage key for tracking fetch attempts
const ORDERS_FETCH_ATTEMPT_KEY = 'orders_fetch_attempted';

const OrdersTable: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addFlashbarItem } = useContext(FlashbarContext);
  
  // Load data function defined with useCallback to prevent recreation on each render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Log attempt to fetch orders
      console.log("Attempting to fetch orders data from S3");
      
      const data = await fetchOrders();
      
      // Log successful fetch
      console.log("Successfully loaded orders data:", data.length, "records");
      
      setOrders(data);
      
      // Successfully loaded data, remove the fetch attempt marker
      localStorage.removeItem(ORDERS_FETCH_ATTEMPT_KEY);
      
    } catch (error) {
      console.error("Error loading orders data:", error);
      const errorMessage = error instanceof Error ? 
        `Failed to load orders data: ${error.message}` :
        'Failed to load orders data. Please try again.';
      
      setError(errorMessage);
      addFlashbarItem("error", errorMessage);
      
      // Mark that we attempted a fetch but failed
      localStorage.setItem(ORDERS_FETCH_ATTEMPT_KEY, 'true');
    } finally {
      setLoading(false);
    }
  }, [addFlashbarItem]);

  // Reset fetch attempt function
  const resetFetchAttempt = useCallback(() => {
    localStorage.removeItem(ORDERS_FETCH_ATTEMPT_KEY);
    loadData(); // Directly call loadData instead of setting state that triggers useEffect
  }, [loadData]);

  // Initial data loading on component mount - only runs once
  useEffect(() => {
    // We'll try to load data regardless of previous attempts
    // since we've implemented a more robust bucket resolution strategy
    loadData();
    
    // If there was a previous failed attempt, clear it
    // This ensures we try with our new bucket resolution approach
    if (localStorage.getItem(ORDERS_FETCH_ATTEMPT_KEY) === 'true') {
      console.log("Clearing previous fetch attempt marker to enable retry with new bucket strategy");
      localStorage.removeItem(ORDERS_FETCH_ATTEMPT_KEY);
    }
  }, [loadData]); // Only depends on the stable loadData function

  const columnDefinitions = [
    {
      id: "order_id",
      header: "Order ID",
      cell: item => item.order_id,
      sortingField: "order_id"
    },
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
      id: "product_name",
      header: "Product Name",
      cell: item => item.product_name,
      sortingField: "product_name"
    },
    {
      id: "order_status",
      header: "Order Status",
      cell: item => {
        let type: StatusIndicatorProps.Type = "success";
        if (item.order_status === "processing") type = "in-progress";
        if (item.order_status === "cancelled") type = "error";
        return <StatusIndicator type={type}>{item.order_status}</StatusIndicator>;
      },
      sortingField: "order_status"
    },
    {
      id: "shipping_status",
      header: "Shipping Status",
      cell: item => item.shipping_status,
      sortingField: "shipping_status"
    },
    {
      id: "return_exchange_status",
      header: "Return/Exchange Status",
      cell: item => item.return_exchange_status,
      sortingField: "return_exchange_status"
    },
    {
      id: "order_date",
      header: "Order Date",
      cell: item => item.order_date,
      sortingField: "order_date"
    },
    {
      id: "delivery_date",
      header: "Delivery Date",
      cell: item => item.delivery_date,
      sortingField: "delivery_date"
    },
  ];

  // Define filtering properties for the property filter
  const filteringProperties = [
    {
      propertyKey: "order_status",
      filteringOption: {
        key: "order_status",
        value: "order_status",
        operator: "=",
      }
    },
    {
      propertyKey: "shipping_status",
      filteringOption: {
        key: "shipping_status",
        value: "shipping_status",
        operator: "=",
      }
    },
    {
      propertyKey: "return_exchange_status",
      filteringOption: {
        key: "return_exchange_status",
        value: "return_exchange_status",
        operator: "=",
      }
    },
  ];

  if (loading) {
    return (
      <Box textAlign="center" padding="l">
        <Spinner size="large" />
        <Box variant="p" padding={{ top: "s" }}>
          Loading orders data...
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="l">
        <Alert type="error" header="Error loading orders data">
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
      title="Customer Orders"
      columnDefinitions={columnDefinitions}
      items={orders}
      filteringProperties={filteringProperties}
    />
  );
};

export default OrdersTable;

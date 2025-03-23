// src/components/OrderManagementTable.tsx

import { useState, useEffect } from "react";

// Import Cloudscape components from sub-paths
import Table from "@cloudscape-design/components/table";
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Tabs from "@cloudscape-design/components/tabs";
import TextFilter from "@cloudscape-design/components/text-filter";

interface DataItem {
  [key: string]: string;
}

const OrderManagementTable = () => {
  const [activeMainTab, setActiveMainTab] = useState("structured");
  const [activeStructuredTab, setActiveStructuredTab] = useState("inventory");
  const [inventoryData, setInventoryData] = useState<DataItem[]>([]);
  const [ordersData, setOrdersData] = useState<DataItem[]>([]);
  const [inventoryColumns, setInventoryColumns] = useState<any[]>([]);
  const [ordersColumns, setOrdersColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventoryFilterText, setInventoryFilterText] = useState("");
  const [ordersFilterText, setOrdersFilterText] = useState("");

  const parseCSVData = async (url: string) => {
    const response = await fetch(`${window.location.origin}${url}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== "");
    const headers = rows[0].split(",").map(h => h.trim());
    
    const columns = headers.map(header => ({
      width: 200,
      id: header,
      header: header,
      cell: (item: DataItem) => item[header],
      sortingField: header
    }));

    const data = rows.slice(1).map(row => {
      const values = row.split(",").map(v => v.trim());
      return headers.reduce((obj: DataItem, header, index) => {
        obj[header] = values[index] || "";
        return obj;
      }, {});
    });

    return { columns, data };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inventoryResult, ordersResult] = await Promise.all([
        parseCSVData('/data/order_mgnt_agent/inventory/inventory.csv'),
        parseCSVData('/data/order_mgnt_agent/orders/orders.csv')
      ]);

      setInventoryColumns(inventoryResult.columns);
      setInventoryData(inventoryResult.data);
      setOrdersColumns(ordersResult.columns);
      setOrdersData(ordersResult.data);
    } catch (error) {
      console.error("Error loading data:", error);
      setError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getFilteredItems = (items: DataItem[], filterText: string) => {
    if (!filterText) {
      return items;
    }
    const lowerFilterText = filterText.toLowerCase();
    return items.filter(item => 
      Object.values(item).some(value => 
        value.toString().toLowerCase().includes(lowerFilterText)
      )
    );
  };

  const renderTable = (
    columns: any[],
    items: DataItem[],
    title: string,
    trackBy: string,
    filterText: string,
    setFilterText: (text: string) => void
  ) => (
    <Table
      trackBy={trackBy}
      variant="full-page"
      wrapLines
      stripedRows
      header={
        <Header
          counter={`(${getFilteredItems(items, filterText).length} items)`}
          actions={<Button onClick={fetchData}>Refresh</Button>}
        >
          {title}
        </Header>
      }
      columnDefinitions={columns}
      items={getFilteredItems(items, filterText)}
      loading={loading}
      loadingText={`Loading ${title.toLowerCase()}`}
      stickyHeader
      resizableColumns
      filter={
        <TextFilter
          filteringPlaceholder={`Search ${title.toLowerCase()}`}
          filteringText={filterText}
          // Add explicit (event: any) to avoid implicit 'any' error
          onChange={(event: any) => setFilterText(event.detail.filteringText)}
        />
      }
      preferences={
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          preferences={{
            pageSize: 10,
            visibleContent: columns.map(col => col.id),
            wrapLines: true,
            stripedRows: true,
            contentDensity: "comfortable"
          }}
        />
      }
      empty={
        <Box textAlign="center" color="inherit">
          <b>No data available</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            {error || "Could not load data"}
          </Box>
        </Box>
      }
    />
  );

  const renderStructuredContent = () => (
    <Tabs
      activeTabId={activeStructuredTab}
      // Add explicit (event: any) to avoid implicit 'any' error
      onChange={(event: any) => setActiveStructuredTab(event.detail.activeTabId)}
      tabs={[
        {
          id: "inventory",
          label: "Inventory Items",
          content: inventoryColumns.length ? 
            renderTable(
              inventoryColumns, 
              inventoryData, 
              "Inventory Items", 
              "ProductID",
              inventoryFilterText,
              setInventoryFilterText
            ) : 
            <Box padding="l">Loading...</Box>
        },
        {
          id: "orders",
          label: "Orders",
          content: ordersColumns.length ? 
            renderTable(
              ordersColumns, 
              ordersData, 
              "Orders", 
              "OrderID",
              ordersFilterText,
              setOrdersFilterText
            ) : 
            <Box padding="l">Loading...</Box>
        }
      ]}
    />
  );

  return (
    <Box padding="l">
      <Header variant="h2">Order Management Data</Header>
      <Box padding={{ vertical: "l" }}>
        <Tabs
          activeTabId={activeMainTab}
          // Add explicit (event: any) to avoid implicit 'any' error
          onChange={(event: any) => setActiveMainTab(event.detail.activeTabId)}
          tabs={[
            {
              id: "structured",
              label: "Structured",
              content: renderStructuredContent()
            }
          ]}
        />
      </Box>
    </Box>
  );
};

export default OrderManagementTable;

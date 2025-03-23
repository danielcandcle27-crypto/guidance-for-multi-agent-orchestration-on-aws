// src/components/PersonalizationTable.tsx

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

const PersonalizationTable = () => {
  console.log('PersonalizationTable component initializing');
  const [activeTab, setActiveTab] = useState("structured");
  const [structuredData, setStructuredData] = useState<DataItem[]>([]);
  const [filteredStructuredData, setFilteredStructuredData] = useState<DataItem[]>([]);
  const [unstructuredData, setUnstructuredData] = useState<DataItem[]>([]);
  const [filteredUnstructuredData, setFilteredUnstructuredData] = useState<DataItem[]>([]);
  const [structuredColumns, setStructuredColumns] = useState<any[]>([]);
  const [unstructuredColumns, setUnstructuredColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structuredFilterText, setStructuredFilterText] = useState("");
  const [unstructuredFilterText, setUnstructuredFilterText] = useState("");

  const parseCSVData = async (url: string) => {
    try {
      const response = await fetch(`${window.location.origin}${url}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const csvText = await response.text();
      if (!csvText.trim()) {
        throw new Error('CSV file is empty');
      }
      const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== "");
      if (rows.length < 2) {
        throw new Error('CSV file must contain header row and at least one data row');
      }
      const headers = rows[0].split(",").map(h => h.trim());
      
      const columns = headers.map(header => ({
        width: 200,
        id: header,
        header: header,
        cell: (item: DataItem) => item[header],
        sortingField: header,
        filteringField: header
      }));

      const data = rows.slice(1).map((row, idx) => {
        const values = row.split(",").map(v => v.trim());
        const obj = headers.reduce((acc: DataItem, header, index) => {
          acc[header] = values[index] || "";
          return acc;
        }, {});
        obj.id = obj.CustomerID || `row-${idx}`;
        return obj;
      });

      return { columns, data };
    } catch (error) {
      console.error("Error parsing CSV data:", error);
      throw error;
    }
  };

  const parseTextData = async (url: string) => {
    try {
      const response = await fetch(`${window.location.origin}${url}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Text file is empty');
      }
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");

      const columns = [
        {
          width: 200,
          id: "browsing_history",
          header: "Browsing History",
          cell: (item: DataItem) => item.content,
          sortingField: "content",
          filteringField: "content"
        }
      ];

      const data = lines.map((line, index) => ({
        id: index.toString(),
        content: line
      }));

      return { columns, data };
    } catch (error) {
      console.error("Error parsing text data:", error);
      throw error;
    }
  };

  const handleStructuredFilter = (filterText: string) => {
    setStructuredFilterText(filterText);
    if (!filterText.trim()) {
      setFilteredStructuredData(structuredData);
      return;
    }
    const filtered = structuredData.filter(item => {
      return Object.values(item).some(value => 
        value.toString().toLowerCase().includes(filterText.toLowerCase())
      );
    });
    setFilteredStructuredData(filtered);
  };

  const handleUnstructuredFilter = (filterText: string) => {
    setUnstructuredFilterText(filterText);
    if (!filterText.trim()) {
      setFilteredUnstructuredData(unstructuredData);
      return;
    }
    const filtered = unstructuredData.filter(item => 
      item.content.toLowerCase().includes(filterText.toLowerCase())
    );
    setFilteredUnstructuredData(filtered);
  };

  const fetchData = async () => {
    setLoading(true);
    console.log('PersonalizationTable: Fetching data...');
    try {
      const [structuredResult, unstructuredResult] = await Promise.all([
        parseCSVData('/data/personalize_agent/structured/customers_preferences.csv'),
        parseTextData('/data/personalize_agent/unstructured/browse_history.txt')
      ]);

      setStructuredColumns(structuredResult.columns);
      setStructuredData(structuredResult.data);
      setFilteredStructuredData(structuredResult.data);
      setUnstructuredColumns(unstructuredResult.columns);
      setUnstructuredData(unstructuredResult.data);
      setFilteredUnstructuredData(unstructuredResult.data);
      console.log('PersonalizationTable: Data fetched successfully', {
        structuredData: structuredResult.data.length,
        unstructuredData: unstructuredResult.data.length
      });
    } catch (error) {
      console.error("Error loading data:", error);
      setError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('PersonalizationTable mounted');
    let mounted = true;
    
    const loadData = async () => {
      if (!mounted) return;
      await fetchData();
    };
    
    loadData();
    
    return () => {
      console.log('PersonalizationTable unmounting');
      mounted = false;
    };
  }, []);

  const renderStructuredTable = () => (
    <Table
      trackBy="id"
      variant="full-page"
      wrapLines
      stripedRows
      header={
        <Header
          counter={`(${filteredStructuredData.length} items)`}
          actions={<Button onClick={fetchData}>Refresh</Button>}
        >
          Customer Preferences
        </Header>
      }
      columnDefinitions={structuredColumns}
      items={filteredStructuredData}
      loading={loading}
      loadingText="Loading customer preferences"
      stickyHeader
      resizableColumns
      filter={
        <TextFilter
          filteringPlaceholder="Search customer preferences"
          filteringText={structuredFilterText}
          // Avoid implicit any by casting the event
          onChange={(event: any) => handleStructuredFilter(event.detail.filteringText)}
        />
      }
      preferences={
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          preferences={{
            pageSize: 10,
            visibleContent: structuredColumns.map(col => col.id),
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

  const renderUnstructuredTable = () => (
    <Table
      trackBy="id"
      variant="full-page"
      wrapLines
      stripedRows
      header={
        <Header
          counter={`(${filteredUnstructuredData.length} items)`}
          actions={<Button onClick={fetchData}>Refresh</Button>}
        >
          Browsing History
        </Header>
      }
      columnDefinitions={unstructuredColumns}
      items={filteredUnstructuredData}
      loading={loading}
      loadingText="Loading browsing history"
      stickyHeader
      resizableColumns
      filter={
        <TextFilter
          filteringPlaceholder="Search browsing history"
          filteringText={unstructuredFilterText}
          onChange={(event: any) => handleUnstructuredFilter(event.detail.filteringText)}
        />
      }
      preferences={
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          preferences={{
            pageSize: 10,
            visibleContent: unstructuredColumns.map(col => col.id),
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

  return (
    <Box padding="l">
      <Header variant="h2">Customer Personalization Data</Header>
      <Box padding={{ vertical: "l" }}>
        <Tabs
          activeTabId={activeTab}
          // Avoid implicit any by casting event
          onChange={(event: any) => setActiveTab(event.detail.activeTabId)}
          tabs={[
            {
              id: "structured",
              label: "Structured Data",
              content: structuredColumns.length ? 
                renderStructuredTable() : 
                <Box padding="l">Loading...</Box>
            },
            {
              id: "unstructured",
              label: "Unstructured Data",
              content: unstructuredColumns.length ? 
                renderUnstructuredTable() : 
                <Box padding="l">Loading...</Box>
            }
          ]}
        />
      </Box>
    </Box>
  );
};

export default PersonalizationTable;

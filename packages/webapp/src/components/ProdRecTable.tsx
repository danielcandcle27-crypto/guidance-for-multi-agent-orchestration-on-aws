// src/components/ProdRecTable.tsx

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

const ProductRecommendationTable = () => {
  console.log('ProductRecommendationTable component initializing');
  const [activeMainTab, setActiveMainTab] = useState("structured");
  const [activeStructuredTab, setActiveStructuredTab] = useState("catalog");
  const [catalogData, setCatalogData] = useState<DataItem[]>([]);
  const [filteredCatalogData, setFilteredCatalogData] = useState<DataItem[]>([]);
  const [purchaseData, setPurchaseData] = useState<DataItem[]>([]);
  const [filteredPurchaseData, setFilteredPurchaseData] = useState<DataItem[]>([]);
  const [feedbackData, setFeedbackData] = useState<DataItem[]>([]);
  const [filteredFeedbackData, setFilteredFeedbackData] = useState<DataItem[]>([]);
  const [catalogColumns, setCatalogColumns] = useState<any[]>([]);
  const [purchaseColumns, setPurchaseColumns] = useState<any[]>([]);
  const [feedbackColumns, setFeedbackColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogFilterText, setCatalogFilterText] = useState("");
  const [purchaseFilterText, setPurchaseFilterText] = useState("");
  const [feedbackFilterText, setFeedbackFilterText] = useState("");

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
          id: "product_recommendation",
          header: "Customer Feedback",
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

  const handleCatalogFilter = (filterText: string) => {
    setCatalogFilterText(filterText);
    if (!filterText.trim()) {
      setFilteredCatalogData(catalogData);
      return;
    }
    const filtered = catalogData.filter(item => {
      return Object.values(item).some(value => 
        value.toString().toLowerCase().includes(filterText.toLowerCase())
      );
    });
    setFilteredCatalogData(filtered);
  };

  const handlePurchaseFilter = (filterText: string) => {
    setPurchaseFilterText(filterText);
    if (!filterText.trim()) {
      setFilteredPurchaseData(purchaseData);
      return;
    }
    const filtered = purchaseData.filter(item => {
      return Object.values(item).some(value => 
        value.toString().toLowerCase().includes(filterText.toLowerCase())
      );
    });
    setFilteredPurchaseData(filtered);
  };

  const handleFeedbackFilter = (filterText: string) => {
    setFeedbackFilterText(filterText);
    if (!filterText.trim()) {
      setFilteredFeedbackData(feedbackData);
      return;
    }
    const filtered = feedbackData.filter(item => 
      item.content.toLowerCase().includes(filterText.toLowerCase())
    );
    setFilteredFeedbackData(filtered);
  };

  const fetchData = async () => {
    setLoading(true);
    console.log('ProductRecommendationTable: Fetching data...');
    try {
      const [catalogResult, purchaseResult, feedbackResult] = await Promise.all([
        parseCSVData('/data/prod_recommendation_agent/structured/product_catalog.csv'),
        parseCSVData('/data/prod_recommendation_agent/structured/purchase_history.csv'),
        parseTextData('/data/prod_recommendation_agent/unstructured/customer_feedback.txt')
      ]);

      setCatalogColumns(catalogResult.columns);
      setCatalogData(catalogResult.data);
      setFilteredCatalogData(catalogResult.data);
      
      setPurchaseColumns(purchaseResult.columns);
      setPurchaseData(purchaseResult.data);
      setFilteredPurchaseData(purchaseResult.data);
      
      setFeedbackColumns(feedbackResult.columns);
      setFeedbackData(feedbackResult.data);
      setFilteredFeedbackData(feedbackResult.data);
    } catch (error) {
      console.error("Error loading data:", error);
      setError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!mounted) return;
      await fetchData();
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  const renderTable = (
    columns: any[],
    items: DataItem[],
    title: string,
    filterText: string,
    onFilterChange: (text: string) => void
  ) => (
    <Table
      trackBy="id"
      variant="full-page"
      wrapLines
      stripedRows
      header={
        <Header
          counter={`(${items.length} items)`}
          actions={<Button onClick={fetchData}>Refresh</Button>}
        >
          {title}
        </Header>
      }
      columnDefinitions={columns}
      items={items}
      loading={loading}
      loadingText={`Loading ${title.toLowerCase()}`}
      stickyHeader
      resizableColumns
      filter={
        <TextFilter
          filteringPlaceholder={`Search ${title.toLowerCase()}`}
          filteringText={filterText}
          // Avoid implicit any by casting event
          onChange={(event: any) => onFilterChange(event.detail.filteringText)}
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
      // Avoid implicit any by casting event
      onChange={(event: any) => setActiveStructuredTab(event.detail.activeTabId)}
      tabs={[
        {
          id: "catalog",
          label: "Product Catalog",
          content: catalogColumns.length ? 
            renderTable(
              catalogColumns, 
              filteredCatalogData, 
              "Product Catalog", 
              catalogFilterText, 
              handleCatalogFilter
            ) : 
            <Box padding="l">Loading...</Box>
        },
        {
          id: "purchase",
          label: "Purchase History",
          content: purchaseColumns.length ? 
            renderTable(
              purchaseColumns, 
              filteredPurchaseData, 
              "Purchase History", 
              purchaseFilterText, 
              handlePurchaseFilter
            ) : 
            <Box padding="l">Loading...</Box>
        }
      ]}
    />
  );

  return (
    <Box padding="l">
      <Header variant="h2">Product Recommendation Data</Header>
      <Box padding={{ vertical: "l" }}>
        <Tabs
          activeTabId={activeMainTab}
          // Avoid implicit any by casting event
          onChange={(event: any) => setActiveMainTab(event.detail.activeTabId)}
          tabs={[
            {
              id: "structured",
              label: "Structured",
              content: renderStructuredContent()
            },
            {
              id: "unstructured",
              label: "Unstructured",
              content: feedbackColumns.length ? 
                renderTable(
                  feedbackColumns, 
                  filteredFeedbackData, 
                  "Customer Feedback", 
                  feedbackFilterText, 
                  handleFeedbackFilter
                ) : 
                <Box padding="l">Loading...</Box>
            }
          ]}
        />
      </Box>
    </Box>
  );
};

export default ProductRecommendationTable;

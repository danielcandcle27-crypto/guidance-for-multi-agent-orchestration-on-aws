import { Table, Box as CloudBox, Header, Button, CollectionPreferences, Tabs, TextFilter } from "./cloudscape-imports";
import { useState, useEffect } from "react";

interface DataItem {
  [key: string]: string;
}

const TroubleshootTable = () => {
  console.log('TroubleshootTable component initializing');
  const [activeMainTab, setActiveMainTab] = useState("unstructured");
  const [activeUnstructuredTab, setActiveUnstructuredTab] = useState("faq");
  const [faqData, setFaqData] = useState<DataItem[]>([]);
  const [filteredFaqData, setFilteredFaqData] = useState<DataItem[]>([]);
  const [tsData, setTsData] = useState<DataItem[]>([]);
  const [filteredTsData, setFilteredTsData] = useState<DataItem[]>([]);
  const [faqColumns, setFaqColumns] = useState<any[]>([]);
  const [tsColumns, setTsColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faqFilterText, setFaqFilterText] = useState("");
  const [tsFilterText, setTsFilterText] = useState("");

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
          id: "troubleshoot_guide",
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
  
  const handleFaqFilter = (filterText: string) => {
    setFaqFilterText(filterText);
    if (!filterText.trim()) {
      setFilteredFaqData(faqData);
      return;
    }
    const filtered = faqData.filter(item => 
      item.content.toLowerCase().includes(filterText.toLowerCase())
    );
    setFilteredFaqData(filtered);
  };

  const handleTsFilter = (filterText: string) => {
    setTsFilterText(filterText);
    if (!filterText.trim()) {
      setFilteredTsData(tsData);
      return;
    }
    const filtered = tsData.filter(item => 
      item.content.toLowerCase().includes(filterText.toLowerCase())
    );
    setFilteredTsData(filtered);
  };

  const fetchData = async () => {
    setLoading(true);
    console.log('TroubleshootTable: Fetching data...');
    try {
      const [faqResult, tsResult] = await Promise.all([
        parseTextData('/data/troubleshoot_agent/faq/faq.txt'),
        parseTextData('/data/troubleshoot_agent/ts/ts_guide.txt')
      ]);

      setFaqColumns(faqResult.columns);
      setFaqData(faqResult.data);
      setFilteredFaqData(faqResult.data);
      setTsColumns(tsResult.columns);
      setTsData(tsResult.data);
      setFilteredTsData(tsResult.data);
      
      console.log('TroubleshootTable: Data fetched successfully', {
        faqData: faqResult.data.length,
        tsData: tsResult.data.length
      });
    } catch (error) {
      console.error("Error loading data:", error);
      setError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('TroubleshootTable mounted');
    let mounted = true;
    
    const loadData = async () => {
      if (!mounted) return;
      await fetchData();
    };
    
    loadData();
    
    return () => {
      console.log('TroubleshootTable unmounting');
      mounted = false;
    };
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
          onChange={({ detail }: { detail: { filteringText: string } }) => onFilterChange(detail.filteringText)}
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
        <CloudBox textAlign="center" color="inherit">
          <b>No data available</b>
          <CloudBox padding={{ bottom: "s" }} variant="p" color="inherit">
            {error || "Could not load data"}
          </CloudBox>
        </CloudBox>
      }
    />
  );

  const renderUnstructuredContent = () => (
    <Tabs
      activeTabId={activeUnstructuredTab}
      onChange={({ detail }: { detail: { activeTabId: string } }) => setActiveUnstructuredTab(detail.activeTabId)}
      tabs={[
        {
          id: "faq",
          label: "FAQ",
          content: faqColumns.length ? 
            renderTable(faqColumns, filteredFaqData, "FAQ", faqFilterText, handleFaqFilter) : 
            <CloudBox padding="l">Loading...</CloudBox>
        },
        {
          id: "troubleshooting",
          label: "Troubleshooting Guide",
          content: tsColumns.length ? 
            renderTable(tsColumns, filteredTsData, "Troubleshooting Guide", tsFilterText, handleTsFilter) : 
            <CloudBox padding="l">Loading...</CloudBox>
        }
      ]}
    />
  );

  return (
    <CloudBox padding="l">
      <Header variant="h2">Troubleshooting Guide</Header>
      <CloudBox padding={{ vertical: "l" }}>
        <Tabs
          activeTabId={activeMainTab}
          onChange={({ detail }: { detail: { activeTabId: string } }) => setActiveMainTab(detail.activeTabId)}
          tabs={[
            {
              id: "unstructured",
              label: "Unstructured",
              content: renderUnstructuredContent()
            }
          ]}
        />
      </CloudBox>
    </CloudBox>
  );
};

export default TroubleshootTable;

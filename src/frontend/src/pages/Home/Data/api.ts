import { fetchFromS3 } from './s3DataService';
import { 
  mockProductCatalog, 
  mockPurchaseHistory, 
  mockCustomerPreferences,
  mockOrders,
  mockInventory
} from './mock-data';

// S3 configuration for bucket paths
const S3_CONFIG = {
  bucket: import.meta.env.VITE_STORAGE_BUCKET_NAME || 'structuredDataBucket',
  ordersPath: 'order_management/orders/orders.csv',
  inventoryPath: 'order_management/inventory/inventory.csv',
  // Paths for other data that might be implemented in the future
  productCatalogPath: 'prod_rec/product_catalog/product_catalog.csv',
  purchaseHistoryPath: 'prod_rec/purchase_history/purchase_history.csv',
  customerPreferencesPath: 'personalization/customer_preferences/customer_preferences.csv',
  customerFeedbackPath: 'customer_feedback.txt', // File is at root of S3 bucket
  browseHistoryPath: 'browse_history.txt', // File is at root of S3 bucket
  faqPath: 'faq/faq.txt',
  troubleshootingPath: 'ts/ts_guide.txt'
};

// Use mock data directly instead of fetching from S3
export const fetchOrders = async () => {
  try {
    console.log("Using mock orders data directly");
    return Promise.resolve(mockOrders);
  } catch (error) {
    console.error("Error loading mock orders data:", error);
    throw error; // Propagate the error to be handled by the component
  }
};

// Use mock data directly instead of fetching from S3
export const fetchInventory = async () => {
  try {
    console.log("Using mock inventory data directly");
    return Promise.resolve(mockInventory);
  } catch (error) {
    console.error("Error loading mock inventory data:", error);
    throw error; // Propagate the error to be handled by the component
  }
};

export const fetchProductCatalog = async () => {
  // Already using mock data, keep as is
  console.log("Using mock product catalog data directly");
  return Promise.resolve(mockProductCatalog);
};

export const fetchPurchaseHistory = async () => {
  try {
    console.log("Using mock purchase history data directly");
    return Promise.resolve(mockPurchaseHistory);
  } catch (error) {
    console.error("Error loading mock purchase history data:", error);
    throw error;
  }
};

export const fetchCustomerPreferences = async () => {
  // Already using mock data, keep as is
  console.log("Using mock customer preferences data directly");
  return Promise.resolve(mockCustomerPreferences);
};

// Function to fetch customer feedback data from mock data
export const fetchCustomerFeedback = async () => {
  try {
    console.log("Using mock customer feedback data directly");
    // Use the function from mock-data.ts that already returns hardcoded data
    return Promise.resolve(await import('./mock-data').then(m => m.fetchCustomerFeedback()));
  } catch (error) {
    console.error("Error fetching mock customer feedback data:", error);
    throw error;
  }
};

// Function to fetch browse history data from mock data
export const fetchBrowseHistory = async () => {
  try {
    console.log("Using mock browse history data directly");
    // Use the function from mock-data.ts that already returns hardcoded data
    return Promise.resolve(await import('./mock-data').then(m => m.fetchBrowseHistory()));
  } catch (error) {
    console.error("Error fetching mock browse history data:", error);
    throw error;
  }
};

// Function to fetch FAQ text content from mock data
export const fetchFAQData = async () => {
  try {
    console.log("Using mock FAQ data directly");
    // Use the function from mock-data.ts that already returns hardcoded data
    return Promise.resolve(await import('./mock-data').then(m => m.fetchFAQData()));
  } catch (error) {
    console.error("Error fetching mock FAQ data:", error);
    throw error;
  }
};

// Function to fetch Troubleshooting Guide text content from mock data
export const fetchTroubleshootingData = async () => {
  try {
    console.log("Using mock troubleshooting data directly");
    // Use the function from mock-data.ts that already returns hardcoded data
    return Promise.resolve(await import('./mock-data').then(m => m.fetchTroubleshootingData()));
  } catch (error) {
    console.error("Error fetching mock troubleshooting data:", error);
    throw error;
  }
};

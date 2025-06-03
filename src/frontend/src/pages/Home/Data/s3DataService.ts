import { getUrl } from 'aws-amplify/storage';
import Papa from 'papaparse';
import { mockOrders, mockInventory, mockPurchaseHistory } from './mock-data';

interface S3FetchOptions {
  bucket?: string;
  path: string;
  type: 'csv' | 'json' | 'text';
}

// Storage key for caching the successful bucket name
const BUCKET_CACHE_KEY = 'last_successful_s3_bucket';

// Known patterns for the bucket names based on CDK deployment
const BUCKET_PATTERNS = [
  'dev-mac-demo-backend-storagestructureddatabucket' // The actual bucket pattern
];

/**
 * Gets a list of potential bucket names to try
 * Prioritizes cached successful bucket name, then the provided bucket name, 
 * then environment variables, and finally hardcoded known patterns
 */
function getPotentialBucketNames(providedBucket?: string): string[] {
  const bucketNames: string[] = [];
  
  // First try the cached successful bucket name if it exists
  const cachedBucket = localStorage.getItem(BUCKET_CACHE_KEY);
  if (cachedBucket) {
    bucketNames.push(cachedBucket);
  }
  
  // Next try the explicitly provided bucket name
  if (providedBucket) {
    bucketNames.push(providedBucket);
  }
  
  // Then try the environment variable
  if (import.meta.env.VITE_STORAGE_BUCKET_NAME) {
    bucketNames.push(import.meta.env.VITE_STORAGE_BUCKET_NAME);
  }
  
  // Add the known bucket names we found
  bucketNames.push('dev-mac-demo-backend-storagestructureddatabucket4f-tazj0etake3z');
  bucketNames.push('dev-mac-demo-backend-multiagentproductrecommendati-vrkyyjn5iaar');
  bucketNames.push('dev-mac-demo-backend-multiagentpersonalizationsuba-hvjtnkt9yhse');
  
  // Add other potential patterns
  BUCKET_PATTERNS.forEach(pattern => {
    if (!bucketNames.includes(pattern)) {
      bucketNames.push(pattern);
    }
  });
  
  return bucketNames;
}

/**
 * Attempts to fetch from S3 with multiple potential bucket names
 */
async function fetchWithRetry<T>(path: string, type: 'csv' | 'json' | 'text', providedBucket?: string): Promise<T[]> {
  const bucketNames = getPotentialBucketNames(providedBucket);
  let lastError: Error | null = null;
  
  // Try each potential bucket name
  for (const bucketName of bucketNames) {
    try {
      console.log(`Attempting to fetch from S3 bucket: ${bucketName}, path=${path}`);
      
      // Get the URL for the file in S3
      const { url } = await getUrl({
        key: path,
        options: {
          bucket: bucketName,  // Specify the bucket name explicitly
          accessLevel: 'private',
          validateObjectExistence: true
        }
      });
      
      console.log(`Successfully got S3 URL for ${path} from bucket ${bucketName}`);
      
      // Cache the successful bucket name for future requests
      localStorage.setItem(BUCKET_CACHE_KEY, bucketName);
      
      // Continue with fetching and parsing the data
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`S3 fetch failed with status: ${response.status} ${response.statusText}`);
      }
      
      const text = await response.text();
      console.log(`Successfully fetched data from S3: ${path} (${text.length} bytes)`);
      
      // Parse based on file type
      if (type === 'csv') {
        return new Promise((resolve, reject) => {
          Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            complete: (results) => {
              console.log(`Successfully parsed CSV data: ${results.data.length} records`);
              console.log('CSV Headers:', results.meta.fields);
              console.log('First record:', results.data[0]);
              resolve(results.data as T[]);
            },
            error: (error) => {
              console.error(`Error parsing CSV data: ${error}`);
              reject(error);
            }
          });
        });
      } else if (type === 'json') {
        const data = JSON.parse(text);
        console.log(`Successfully parsed JSON data: ${Array.isArray(data) ? data.length : 'object'}`);
        return data;
      } else {
        console.log(`Returning raw text data: ${text.length} characters`);
        return text as unknown as T[];
      }
      
    } catch (error) {
      console.warn(`Failed to fetch with bucket ${bucketName}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to the next bucket name
    }
  }
  
  // If we get here, all bucket names failed
  throw lastError || new Error('Failed to fetch from all potential buckets');
}

/**
 * Fetches data from an S3 bucket and returns it in the requested format
 * Falls back to mock data if S3 fetch fails
 * 
 * @param options The options for fetching data
 * @returns Parsed data from the S3 file or mock data as fallback
 */
export async function fetchFromS3<T>({ path, type = 'csv', bucket }: S3FetchOptions): Promise<T[]> {
  try {
    // Log the attempt with path details
    console.log(`Attempting to fetch from S3: bucket=${bucket || 'default'}, path=${path}`);
    
    // Use the retry logic to find the correct bucket
    return await fetchWithRetry<T>(path, type, bucket);
    
    // This section is removed as it's now handled in the fetchWithRetry function
  } catch (error) {
    console.error(`Error fetching from S3: ${path}`, error);
    
    // Generate a more descriptive error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Attempting to use fallback mock data for: ${path}`);
    
    // Fallback to mock data based on the path
    if (path.includes('orders/orders.csv')) {
      console.log('Using mock orders data as fallback');
      return mockOrders as unknown as T[];
    } else if (path.includes('inventory/inventory.csv')) {
      console.log('Using mock inventory data as fallback');
      return mockInventory as unknown as T[];
    } else if (path.includes('purchase_history/purchase_history.csv')) {
      console.log('Using mock purchase history data as fallback');
      return mockPurchaseHistory as unknown as T[];
    }
    
    // If no specific mock data available, rethrow with detailed message
    throw new Error(`Failed to fetch data from S3 (${path}): ${errorMessage}. No fallback data available.`);
  }
}

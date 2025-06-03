# S3 Data Integration for Dashboard Tables

This document explains how the data integration with S3 works in the dashboard tables components.

## Overview

The dashboard tables (Orders, Inventory) display data that is dynamically fetched from AWS S3 buckets upon page load. This approach ensures that users always see the most up-to-date information stored in the AWS infrastructure, rather than static mock data.

```
┌────────────────┐     ┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│    React UI    │     │   API Layer │     │  S3DataService│     │     AWS      │
│  Components    │────>│  (api.ts)   │────>│  (AWS Amplify)│────>│     S3       │
└────────────────┘     └─────────────┘     └───────────────┘     └──────────────┘
     Returns              Transforms         Fetches & Parses      Stores Data
    Formatted UI          CSV to JSON        Raw Data              as CSV Files
```

## Key Components

### 1. S3DataService (`s3DataService.ts`)

A utility service that handles fetching data from S3 buckets using AWS Amplify's Storage API.

Features:
- Secure authentication via Cognito
- Support for different data formats (CSV, JSON, plain text)
- CSV parsing using PapaParse library
- Comprehensive error handling

### 2. API Layer (`api.ts`)

Interface between UI components and S3 data:
- Configures S3 bucket paths
- Calls S3DataService to fetch data
- Transforms and formats data for UI consumption
- Provides consistent error handling

### 3. UI Components

Table components that display the fetched data:
- `OrdersTable.tsx` - Displays order management data
- `InventoryTable.tsx` - Displays inventory data

## S3 Bucket Structure

Data is organized in the S3 bucket as follows:

```
structuredDataBucket/
├── order_management/
│   ├── orders/
│   │   └── orders.csv
│   └── inventory/
│       └── inventory.csv
├── prod_rec/
│   └── product_catalog/
│       └── product_catalog.csv
├── personalization/
│   ├── purchase_history/
│   │   └── purchase_history.csv
│   └── customer_preferences/
│       └── customer_preferences.csv
└── knowledge-base/
    ├── customer_feedback.txt
    ├── browse_history.txt
    ├── faq/
    │   └── faq.txt
    └── ts/
        └── ts_guide.txt
```

## CSV File Format

### Orders CSV

The Orders CSV file should include the following columns:
- order_id
- customer_id
- product_id
- product_name
- order_status
- shipping_status
- return_exchange_status
- order_date
- delivery_date

Example:
```
order_id,customer_id,product_id,product_name,order_status,shipping_status,return_exchange_status,order_date,delivery_date
o001,cust001,prod001,zensound wireless headphones,delivered,delivered,not returned,10/25/24 10:00,10/30/24 12:00
```

### Inventory CSV

The Inventory CSV file should include the following columns:
- product_id
- product_name
- category
- quantity
- in_stock
- reorder_threshold
- reorder_quantity
- last_restock_date

Example:
```
product_id,product_name,category,quantity,in_stock,reorder_threshold,reorder_quantity,last_restock_date
p001,zensound wireless headphones,headphones,150,yes,50,100,10/1/24
```

## Configuration

### Environment Variables

The following environment variables are used:

- `VITE_STORAGE_BUCKET_NAME`: Name of the S3 bucket storing the data files
- `VITE_USER_POOL_ID`: Cognito user pool ID for authentication
- `VITE_USER_POOL_CLIENT_ID`: Cognito client ID for authentication
- `VITE_IDENTITY_POOL_ID`: Cognito identity pool ID for authentication

### AWS Amplify Configuration

AWS Amplify is configured in `App.tsx` and automatically manages authentication for S3 access.

## Error Handling

The system handles errors at multiple levels:

1. **S3DataService Level**: Catches and logs S3 access and parsing errors
2. **API Layer**: Adds context to errors and propagates them to UI
3. **UI Components**: Display user-friendly error messages and report to Flashbar

## Troubleshooting

### Common Issues

1. **Access Denied Errors**:
   - Verify AWS credentials and permissions
   - Check Cognito setup in App.tsx
   - Ensure S3 bucket has proper CORS configuration

2. **Data Format Errors**:
   - Confirm CSV files match expected format
   - Check for header case sensitivity
   - Verify file encoding is UTF-8

3. **Missing Data**:
   - Verify S3 paths in api.ts match actual bucket structure
   - Check file names match expected conventions
   - Ensure bucket name environment variable is set correctly

### Debugging

For debugging issues:

1. Check browser console for errors
2. Examine network tab for failed S3 requests
3. Look for authentication errors in Cognito logs
4. Verify file paths against S3 bucket structure

## Extending the System

To add support for more data sources:

1. Add new path constants in the S3_CONFIG object in api.ts
2. Create appropriate fetch functions in api.ts
3. Create or update UI components to use the new data

## Fallback Mechanism

Per requirements, the system does NOT fall back to mock data if S3 retrieval fails. Instead, it displays an error message to the user. This ensures users are aware when data is not available rather than seeing potentially outdated mock data.

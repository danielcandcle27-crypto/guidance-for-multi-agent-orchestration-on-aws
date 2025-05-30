/**
 * Environment Variable Preservation Helper
 * 
 * Run this script after "Refresh Local Environment" to ensure critical environment
 * variables are preserved and not lost during environment refreshes.
 * 
 * Usage: node preserve-env-vars.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.join(__dirname, '.env');

// Essential environment variables that must be present
const ESSENTIAL_ENV_VARS = {
  'VITE_ROUTING_CLASSIFIER_AGENT_ID': 'ONE1CHTK2D',
  'VITE_ROUTING_CLASSIFIER_ALIAS_ID': 'TSTALIASRC',
  'VITE_WEBSOCKET_ENDPOINT': 'wss://dy5ov5fupvhfpo4m52js55npyu.appsync-realtime-api.us-east-1.amazonaws.com/graphql'
};

// Read existing .env file
let existingEnvVars = {};
try {
  const envFileContent = fs.readFileSync(envFilePath, 'utf8');
  
  // Parse existing environment variables
  envFileContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('='); // Handle values that may contain = character
      if (key) {
        existingEnvVars[key.trim()] = value.trim();
      }
    }
  });
  
  console.log('Read existing .env file successfully');
} catch (err) {
  console.log('No existing .env file found or error reading it:', err.message);
  existingEnvVars = {};
}

// Merge with essential vars, giving priority to existing vars if they exist
const mergedVars = { ...ESSENTIAL_ENV_VARS, ...existingEnvVars };

// Check if essential vars might be missing from existing env
let missingVars = [];
for (const [key, value] of Object.entries(ESSENTIAL_ENV_VARS)) {
  if (!existingEnvVars[key]) {
    missingVars.push(key);
    // Add the essential var
    mergedVars[key] = value;
  }
}

// Ensure we don't have duplicates (e.g. VITE_VITE_*)
const fixedVars = {};
for (const [key, value] of Object.entries(mergedVars)) {
  const fixedKey = key.startsWith('VITE_VITE_') ? key.replace('VITE_VITE_', 'VITE_') : key;
  fixedVars[fixedKey] = value;
}

// Generate new .env file content
const newEnvContent = Object.entries(fixedVars)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n') + '\n';

// Write back to .env file
fs.writeFileSync(envFilePath, newEnvContent);

console.log('\n=== Environment Variables Preservation ===');
console.log('Updated .env file with essential environment variables');

if (missingVars.length > 0) {
  console.log('\nAdded missing essential variables:');
  missingVars.forEach(key => console.log(`- ${key}`));
}

console.log('\nFixed any duplicate VITE_ prefixes');
console.log('\nYour environment is now ready for development!');
console.log('==========================================');

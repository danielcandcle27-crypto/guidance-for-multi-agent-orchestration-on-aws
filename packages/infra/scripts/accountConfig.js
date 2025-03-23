"use strict";

// Import the compiled JS version of your AppConfig.ts
const { accountMappings } = require('../dist/config/AppConfig');
console.log("DEBUG: accountMappings from AppConfig:", accountMappings);

// Find the DEV entry in the imported array
const devMapping = accountMappings.find((x) => x.type === 'DEV');

if (!devMapping) {
  throw new Error('Could not find DEV in accountMappings from AppConfig.ts');
}

// Extract the AWS account ID
const DevAccountId = devMapping.account || process.env.CDK_DEFAULT_ACCOUNT;

// Export the ID and mapping
module.exports = {
  devMapping,
  DevAccountId,
  accountMappings
};

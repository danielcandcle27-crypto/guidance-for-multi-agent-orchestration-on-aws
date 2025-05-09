#!/usr/bin/env node
/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${colors.cyan}Starting CDK Nag scan...${colors.reset}`);

// Build the TypeScript code first
try {
  console.log(`${colors.blue}Building TypeScript code...${colors.reset}`);
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error(`${colors.red}Failed to build TypeScript code:${colors.reset}`, error);
  process.exit(1);
}

// Add environment variable to allow the CDK nag to emit warnings but not fail the synth
process.env.CDK_NAG_FAIL_ON_ERROR = 'false';

// Run CDK synth with CDK_NAG=true to enable nag reporting
let synthSucceeded = false;
try {
  console.log(`${colors.blue}Running CDK synth with nag enabled...${colors.reset}`);
  execSync('CDK_NAG=true npx aws-cdk synth', { 
    stdio: 'inherit',
    env: { 
      ...process.env,
      CDK_NAG_FAIL_ON_ERROR: 'false' 
    }
  });
  console.log(`${colors.green}CDK synth completed successfully.${colors.reset}`);
  synthSucceeded = true;
} catch (error) {
  console.error(`${colors.red}CDK synth encountered errors.${colors.reset}`);
  console.log(`${colors.yellow}Continuing with nag analysis of any available output...${colors.reset}`);
  // Don't exit - try to analyze any output that was generated before the error
}

// Check if cdk.out directory exists
const cdkOutDir = path.join(process.cwd(), 'cdk.out');
if (!fs.existsSync(cdkOutDir)) {
  console.warn(`${colors.yellow}Warning: cdk.out directory not found. Creating the directory...${colors.reset}`);
  try {
    fs.mkdirSync(cdkOutDir, { recursive: true });
    console.log(`${colors.green}Created cdk.out directory.${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Failed to create cdk.out directory: ${error.message}${colors.reset}`);
    console.error(`${colors.yellow}CDK Nag analysis will continue but may not find any issues.${colors.reset}`);
  }
}

// Look for CDK Nag output files (both JSON and CSV formats)
const nagFiles = [];
function findNagFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`${colors.yellow}Warning: Directory ${dir} does not exist. Skipping...${colors.reset}`);
    return;
  }
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          findNagFiles(filePath);
        } else if (
          // Look for both original JSON format and the CSV report format
          file === 'nag-output.json' || 
          (file.startsWith('AwsSolutions-') && file.endsWith('-NagReport.csv'))
        ) {
          nagFiles.push(filePath);
        }
      } catch (error) {
        console.warn(`${colors.yellow}Warning: Could not access ${filePath}: ${error.message}${colors.reset}`);
      }
    }
  } catch (error) {
    console.warn(`${colors.yellow}Warning: Could not read directory ${dir}: ${error.message}${colors.reset}`);
  }
}

findNagFiles(cdkOutDir);

// Process and display nag findings
if (nagFiles.length === 0) {
  console.log(`${colors.yellow}No CDK Nag output files found. Make sure CDK Nag is properly configured in your CDK app.${colors.reset}`);
} else {
  console.log(`${colors.green}Found ${nagFiles.length} CDK Nag output files.${colors.reset}`);
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // Create a consolidated findings list
  const consolidatedFindings = [];
  
  nagFiles.forEach(filePath => {
    try {
      const fileExt = path.extname(filePath);
      const stackNameMatch = path.basename(filePath).match(/^AwsSolutions-(.*)-NagReport\.csv$/);
      const stackName = stackNameMatch ? stackNameMatch[1] : path.basename(path.dirname(filePath));
      
      console.log(`\n${colors.cyan}=== Stack: ${stackName} ===${colors.reset}`);
      
      if (fileExt === '.json') {
        // Process JSON format
        const nagData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (!nagData.findings || nagData.findings.length === 0) {
          console.log(`${colors.green}No issues found!${colors.reset}`);
          return;
        }
        
        // Add findings to consolidated list
        nagData.findings.forEach(finding => {
          consolidatedFindings.push({
            ruleId: finding.ruleId,
            ruleName: finding.ruleName,
            description: finding.description,
            resource: finding.resource,
            level: finding.level,
            stack: stackName
          });
          
          if (finding.level === 'ERROR') {
            totalErrors++;
          } else {
            totalWarnings++;
          }
        });
      } else if (fileExt === '.csv') {
        // Process CSV format
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const lines = csvContent.split('\n');
        
        // Skip header row
        if (lines.length <= 1) {
          console.log(`${colors.green}No issues found!${colors.reset}`);
          return;
        }
        
        // Process each line (starting from index 1 to skip header)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // CSV format: RuleId,Resource,Level,Description (approximately)
          const parts = line.split(',');
          if (parts.length < 3) continue;
          
          const ruleId = parts[0].trim();
          const resource = parts[1].trim();
          const level = parts[2].trim();
          const description = parts.slice(3).join(',').trim();
          
          consolidatedFindings.push({
            ruleId,
            ruleName: ruleId,
            description,
            resource,
            level: level.toUpperCase() === 'ERROR' ? 'ERROR' : 'WARNING',
            stack: stackName
          });
          
          if (level.toUpperCase() === 'ERROR') {
            totalErrors++;
          } else {
            totalWarnings++;
          }
        }
      }
      
      // Group findings by rule ID for this stack
      const stackFindings = consolidatedFindings.filter(f => f.stack === stackName);
      const findingsByRule = {};
      
      stackFindings.forEach(finding => {
        if (!findingsByRule[finding.ruleId]) {
          findingsByRule[finding.ruleId] = [];
        }
        findingsByRule[finding.ruleId].push(finding);
      });
      
      // Display findings grouped by rule for this stack
      if (Object.keys(findingsByRule).length === 0) {
        console.log(`${colors.green}No issues found!${colors.reset}`);
      } else {
        Object.keys(findingsByRule).forEach(ruleId => {
          const findings = findingsByRule[ruleId];
          const level = findings[0].level;
          const color = level === 'ERROR' ? colors.red : colors.yellow;
          
          console.log(`\n${color}[${level}] Rule: ${ruleId}${colors.reset}`);
          if (findings[0].description) {
            console.log(`${color}Description: ${findings[0].description}${colors.reset}`);
          }
          
          findings.forEach(finding => {
            console.log(`${color}- Resource: ${finding.resource}${colors.reset}`);
          });
        });
      }
    } catch (error) {
      console.error(`${colors.red}Failed to process ${filePath}:${colors.reset}`, error);
    }
  });
  
  // Copy CDK nag reports to the cdk-nag-output.txt file
  const cdkNagOutputPath = path.join(process.cwd(), '..', '..', 'cdk-nag-output.txt');
  try {
    // Create a nicely formatted summary for the output file
    let outputContent = `CDK Nag Analysis Summary\n`;
    outputContent += `=======================\n\n`;
    outputContent += `Total Errors: ${totalErrors}\n`;
    outputContent += `Total Warnings: ${totalWarnings}\n\n`;
    
    // Group all findings by stack
    const findingsByStack = {};
    consolidatedFindings.forEach(finding => {
      if (!findingsByStack[finding.stack]) {
        findingsByStack[finding.stack] = [];
      }
      findingsByStack[finding.stack].push(finding);
    });
    
    // Add findings to output by stack
    Object.keys(findingsByStack).sort().forEach(stack => {
      outputContent += `\nStack: ${stack}\n`;
      outputContent += `${'='.repeat(stack.length + 7)}\n\n`;
      
      // Group by rule ID within stack
      const ruleGroups = {};
      findingsByStack[stack].forEach(finding => {
        if (!ruleGroups[finding.ruleId]) {
          ruleGroups[finding.ruleId] = [];
        }
        ruleGroups[finding.ruleId].push(finding);
      });
      
      // Add rule findings
      Object.keys(ruleGroups).sort().forEach(ruleId => {
        const findings = ruleGroups[ruleId];
        const level = findings[0].level;
        
        outputContent += `[${level}] Rule: ${ruleId}\n`;
        if (findings[0].description) {
          outputContent += `Description: ${findings[0].description}\n`;
        }
        
        // List resources
        findings.forEach(finding => {
          outputContent += `- Resource: ${finding.resource}\n`;
        });
        outputContent += '\n';
      });
    });
    
    // Write to file
    fs.writeFileSync(cdkNagOutputPath, outputContent, 'utf8');
    console.log(`${colors.green}CDK Nag report written to: ${cdkNagOutputPath}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Failed to write CDK Nag output file: ${error.message}${colors.reset}`);
  }
  
  // Summary
  console.log(`\n${colors.cyan}=== Summary ===${colors.reset}`);
  
  if (!synthSucceeded) {
    console.log(`${colors.red}⚠️ CDK synthesis had errors. The nag analysis may be incomplete.${colors.reset}`);
  }
  
  console.log(`${colors.red}Errors: ${totalErrors}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${totalWarnings}${colors.reset}`);
  
  if (totalErrors > 0) {
    console.log(`\n${colors.red}⚠️ CDK Nag found ${totalErrors} errors that should be addressed.${colors.reset}`);
  } else if (totalWarnings > 0) {
    console.log(`\n${colors.yellow}⚠️ CDK Nag found ${totalWarnings} warnings to review.${colors.reset}`);
  } else if (nagFiles.length === 0) {
    console.log(`\n${colors.yellow}⚠️ No CDK Nag output files were found. Analysis may have failed.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}✅ No CDK Nag issues found!${colors.reset}`);
  }
  
  // Return non-zero exit code if synth failed, but don't exit immediately to allow seeing the output
  if (!synthSucceeded) {
    process.exitCode = 1;
  }
}

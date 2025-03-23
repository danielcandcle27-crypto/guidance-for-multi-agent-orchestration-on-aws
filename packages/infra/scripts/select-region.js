#!/usr/bin/env node
const readline = require('readline');

/**
 * Prompts the user to select a region (us-east-1 or us-west-2)
 * and returns the selected region.
 */
function selectRegion() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n=== AWS Region Selection ===');
    console.log('1) us-east-1 (N. Virginia)');
    console.log('2) us-west-2 (Oregon) [default]');
    
    rl.question('\nSelect a region [2]: ', (answer) => {
      rl.close();
      
      const selection = answer.trim();
      
      if (!selection || selection === '2') {
        console.log('Selected region: us-west-2');
        resolve('us-west-2');
      } else if (selection === '1') {
        console.log('Selected region: us-east-1');
        resolve('us-east-1');
      } else {
        console.log('Invalid selection, using default region: us-west-2');
        resolve('us-west-2');
      }
    });
  });
}

module.exports = { selectRegion };
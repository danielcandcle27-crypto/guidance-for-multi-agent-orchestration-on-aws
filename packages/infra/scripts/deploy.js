const { spawn, execSync } = require('child_process');
const { DevAccountId } = require('./accountConfig');
const { selectRegion } = require('./select-region');

// Import projectName from your compiled TS config
const { projectName } = require('../dist/config/AppConfig');

async function deploy() {
  try {
    // 1) Get current AWS account
    let currentAccount;
    let selectedRegion;
    try {
      currentAccount = execSync('aws sts get-caller-identity --query Account --output text')
        .toString()
        .trim();
        
      // Prompt for region selection between us-west-2 (default) and us-east-1
      selectedRegion = await selectRegion();
      console.log(`Using region: ${selectedRegion}`);
      
      // Set AWS_REGION for this process and CDK
      process.env.AWS_REGION = selectedRegion;
      process.env.CDK_DEFAULT_REGION = selectedRegion;
      
      // Also set for AWS CLI commands
      execSync(`aws configure set region ${selectedRegion}`);
    } catch (error) {
      throw new Error('Error getting AWS account ID. Make sure you are logged into AWS CLI.');
    }

    // Only DEV environment is supported
    const environment = 'DEV';
    
    console.log(`Using AWS account ${currentAccount} for deployment...`);

    console.log(`Deploying to ${environment} environment using account ${currentAccount}...`);

    // For naming in the CDK command
    const envNameL = environment.toLowerCase(); // "dev" or "prod"
    const envNameU = environment.charAt(0) + environment.slice(1).toLowerCase(); // "Dev" or "Prod"

    // 4) Deploy Infra Stack
    // Example: "cdk deploy mac-demo-pipelineStack-prod/mac-demo-Prod/infra/*"
    const infraStackCommand = `cdk deploy ${projectName}-pipelineStack-${envNameL}/${projectName}-${envNameU}/infra/*`;
    console.log(`Deploying infrastructure: ${infraStackCommand}`);
    await new Promise((resolve, reject) => {
      const child = spawn('npx', infraStackCommand.split(' '), {
        stdio: 'inherit',
        env: { 
          ...process.env, 
          ENVIRONMENT: environment,
          IS_DEV: environment === 'DEV' ? 'true' : 'false', }
      });
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Infrastructure deployment failed'));
        } else {
          resolve();
        }
      });
    });

    // 5) Deploy Pipeline / Multi-Agent
    // Example: "cdk deploy mac-demo-pipelineStack-prod/mac-demo-Prod/* --require-approval never"
    const pipelineStackCommand = `cdk deploy "${projectName}-pipelineStack-${envNameL}/${projectName}-${envNameU}/*" --require-approval never`;
    console.log(`Deploying pipeline: ${pipelineStackCommand}`);
    await new Promise((resolve, reject) => {
      const child = spawn('npx', pipelineStackCommand.split(' '), {
        stdio: 'inherit',
        env: { ...process.env, ENVIRONMENT: environment }
      });
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Pipeline deployment failed'));
        } else {
          resolve();
        }
      });
    });

    console.log('Deployment successful.');
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

deploy().catch((err) => {
  console.error('Deployment failed:', err.message);
  process.exit(1);
});

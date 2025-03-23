#!/usr/bin/env node
"use strict";

const { spawn, execSync } = require("child_process");
const readline = require("readline");
const { DevAccountId, ProdAccountId } = require("./accountConfig");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const defaultEnv = "DEV";

function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function getEnvironment() {
  const envInput = await askQuestion(
    `Enter environment for DEV or PROD (default: ${defaultEnv}): `
  );
  return envInput.trim().toUpperCase() || defaultEnv;
}

async function setupPipeline() {
  try {
    // 1) Identify current AWS account
    let currentAccount;
    try {
      currentAccount = execSync(
        "aws sts get-caller-identity --query Account --output text"
      )
        .toString()
        .trim();
    } catch (error) {
      throw new Error(
        "Error getting AWS account ID. Make sure you are logged into AWS CLI."
      );
    }

    // 2) Ask for DEV or PROD
    const environment = await getEnvironment();
    if (!["DEV", "PROD"].includes(environment)) {
      throw new Error('Invalid environment. Must be either "DEV" or "PROD".');
    }

    // 3) Ensure correct AWS account
    const requiredAccount =
      environment === "PROD" ? ProdAccountId : DevAccountId;
    if (currentAccount !== requiredAccount) {
      throw new Error(
        `Current AWS account (${currentAccount}) does not match required account (${requiredAccount}) for ${environment}.`
      );
    }

    console.log(
      `Setting up pipeline in ${environment} environment, using account ${currentAccount}...`
    );

    // 4) Define the CDK deploy command safely (as an array)
    const cdkDeployCommand = ["cdk", "deploy", "--all", "--require-approval", "never"];
    
    console.log(`Deploying pipeline with command: ${cdkDeployCommand.join(" ")}`);

    // 5) Spawn the process with `shell: false`
    await new Promise((resolve, reject) => {
      const child = spawn(cdkDeployCommand[0], cdkDeployCommand.slice(1), {
        stdio: "inherit",
        shell: false,  // ✅ More secure
        env: {
          ...process.env,
          ENVIRONMENT: environment, // pass to infra.ts
          IS_DEV: environment === "DEV" ? "true" : "false",
        },
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Pipeline setup failed with exit code ${code}`));
        } else {
          resolve();
        }
      });
    });

    console.log("Pipeline setup completed successfully.");
  } catch (error) {
    console.error("Pipeline setup error:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupPipeline();

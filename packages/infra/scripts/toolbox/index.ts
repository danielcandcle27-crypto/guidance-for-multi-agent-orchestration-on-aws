import { spawn } from "child_process";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  CloudFormationClient,
  ListExportsCommand,
} from "@aws-sdk/client-cloudformation";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { resolve, join } from "path";
import {
  writeFileSync,
  unlinkSync,
  readdirSync,
  existsSync,
  readFileSync,
} from "fs";
import { projectName, accountMappings } from "../../config/AppConfig";
import { envConfig } from "./config";

import * as envfile from "envfile";
import mime from "mime-types";

// Include a profile only if one is supplied
const profileStage = process.argv[2];
const targetAccount = accountMappings.find(
  (account) => account.type === (profileStage ?? "DEV")
);

// Location where the env file will be created
const envPath = resolve(__dirname, "..", "..", "..", "..", "webapp", "src", ".env");
// Location of web app dist folder
const webappDistPath = resolve(__dirname, "..", "..", "..", "..", "webapp", "dist");
const REGION = targetAccount?.region ?? "us-west-2";

/**
 * Recursively list all files in a directory.
 */
function* readAllFiles(dir: string): Generator<string> {
  const files = readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      yield* readAllFiles(join(dir, file.name));
    } else {
      yield join(dir, file.name);
    }
  }
}

/**
 * Hardcoded function to build the web app using a safe, fixed command.
 * There is no user input to determine what command is run.
 */
function buildWebApp(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use a *fixed* executable path and arguments
    const child = spawn("/usr/bin/npm", ["run", "-w", "webapp", "build"], {
      shell: false, // No shell interpretation
    });

    child.stdout.on("data", (data) => {
      console.log(`${data}`);
    });

    child.stderr.on("data", (data) => {
      console.error(`${data}`);
    });

    child.on("error", (err) => {
      console.error(`Child process error: ${err}`);
      reject(err);
    });

    child.on("close", (code, signal) => {
      const respPayload = JSON.stringify({
        cmd: "/usr/bin/npm",
        args: ["run", "-w", "webapp", "build"],
        code,
        signal,
      });

      if (code !== 0) {
        reject(new Error(respPayload));
      } else {
        resolve(respPayload);
      }
    });
  });
}

/**
 * Assume an AWS IAM Role and retrieve temporary credentials.
 */
async function getCrossAccountCredentials() {
  try {
    // Rename local var to avoid "command"
    const assumeRoleParams = new AssumeRoleCommand({
      RoleArn: `arn:aws:iam::${targetAccount?.account}:role/${projectName}-deploy-website`,
      RoleSessionName: `${projectName}-${profileStage ?? "DEV"}`,
      DurationSeconds: 900,
    });

    const stsClient = new STSClient({ region: REGION });
    const response = await stsClient.send(assumeRoleParams);

    if (response.Credentials) {
      return {
        accessKeyId: response.Credentials.AccessKeyId,
        secretAccessKey: response.Credentials.SecretAccessKey,
        sessionToken: response.Credentials.SessionToken,
      };
    }
  } catch (error) {
    console.error(error);
    throw new Error("Unable to get credentials");
  }
  return null;
}

/**
 * List all CloudFormation exports in the target AWS account.
 */
async function listExports(credentials: any) {
  try {
    const cfClient = new CloudFormationClient({
      region: REGION,
      credentials: {
        accessKeyId: credentials.accessKeyId ?? "",
        secretAccessKey: credentials.secretAccessKey ?? "",
        sessionToken: credentials.sessionToken ?? "",
      },
    });

    // Rename local var to avoid "command"
    const listExportsParams = new ListExportsCommand({});
    const response = await cfClient.send(listExportsParams);
    return response.Exports ?? [];
  } catch (error) {
    console.error(error);
    throw new Error("Unable to list Exports");
  }
}

async function main() {
  try {
    // 1. Assume role to get credentials
    const credentials = await getCrossAccountCredentials();

    // 2. List all CloudFormation exports
    const exportsList = credentials ? await listExports(credentials) : [];
    if (!credentials || exportsList.length < 1) {
      throw new Error("Missing required exports");
    }

    // 3. Generate .env in webapp folder
    const envObject = envConfig.reduce((acc, cfg) => {
      const exportItem = exportsList.find(
        (e) => e.Name === `${projectName}-${cfg.exportKey}`
      );
      return {
        ...acc,
        [cfg.envKey]: exportItem?.Value ?? "",
      };
    }, {} as Record<string, string>);

    if (existsSync(envPath)) {
      console.log("Deleting existing env file");
      unlinkSync(envPath);
    } else {
      console.log("No existing env file found. Skipping deletion");
    }

    writeFileSync(
      envPath,
      envfile.stringify({
        VITE_PROJECT_NAME: projectName,
        VITE_REGION: REGION,
        ...envObject,
      })
    );
    console.log("Env file created successfully!");

    // 4. Build web app with a fixed command (no user input)
    const webAppBuildResult = await buildWebApp();
    console.log("🚀 ~ Webapp build success:", webAppBuildResult);

    // 5. Upload files to S3 website bucket
    const s3Client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: credentials.accessKeyId ?? "",
        secretAccessKey: credentials.secretAccessKey ?? "",
        sessionToken: credentials.sessionToken ?? "",
      },
    });

    const websiteBucketName =
      exportsList
        .find((e) => e.Name === `${projectName}-config-website-s3-bucket-name`)
        ?.Value?.replace("s3://", "") ?? "";

    for (const filePath of readAllFiles(webappDistPath)) {
      const file = readFileSync(filePath);
      const mimeType = mime.lookup(filePath);
      const s3UploadResp = await s3Client.send(
        new PutObjectCommand({
          Bucket: websiteBucketName,
          Key: filePath.replace(`${webappDistPath}/`, ""),
          Body: file,
          ContentType: mimeType || undefined,
        })
      );
      console.log("🚀 ~ File uploaded:", s3UploadResp);
    }
    console.log("Website file upload complete");

    // 6. Invalidate CloudFront distribution
    const cfClient = new CloudFrontClient({
      region: REGION,
      credentials: {
        accessKeyId: credentials.accessKeyId ?? "",
        secretAccessKey: credentials.secretAccessKey ?? "",
        sessionToken: credentials.sessionToken ?? "",
      },
    });

    const DistributionId =
      exportsList.find(
        (e) => e.Name === `${projectName}-config-website-distribution-id`
      )?.Value ?? "";

    // Rename local var to avoid "command"
    const invalidateParams = new CreateInvalidationCommand({
      DistributionId,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: {
          Quantity: 1,
          Items: ["/*"],
        },
      },
    });

    const cfResponse = await cfClient.send(invalidateParams);
    console.log("🚀 ~ CloudFront Invalidation Response:", cfResponse);

    console.log("🚀 Website build & upload success");
  } catch (error) {
    console.error(error);
    throw new Error("Failed deploying website");
  }
}

// Kick off the main workflow
main();

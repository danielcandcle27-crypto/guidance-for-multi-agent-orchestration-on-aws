#!/usr/bin/env node

import {
    CloudFormationClient,
    DescribeStacksCommand,
    ListStacksCommand,
    Output,
    StackSummary
} from "@aws-sdk/client-cloudformation";
import { blueBright, bold, greenBright, redBright } from "chalk";
import enquirer from "enquirer";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { projectConfig } from "../../config";
import {
    banner,
    bye,
    executeCommand,
    freePort,
    getCfnStackName,
    getCloudFormationSafeName,
    getProfileName,
    getStackPrefix,
    promptConfirm,
    promptMultiSelect,
    promptSelect,
    refreshCredentials,
} from "./utils";

enum Operations {
    REFRESH_CREDS = "Refresh Credentials 🔑",
    SYNTHESIZE_CDK = "Synthesize CDK Stacks 🗂️",
    DEPLOY_CDK = "Deploy CDK Stack(s) 🚀",
    HOTSWAP_CDK = "Hotswap CDK Stack(s) 🔥",
    DEPLOY_FRONTEND = "Deploy Frontend 🖥️",
    REFRESH_ENV = "Refresh Local Environment 📦",
    TEST_FRONTEND = "Test Frontend Locally 💻",
    DESTROY_CDK = "Destroy CDK Stack(s) 🗑️",
    EXIT = "Exit 👋",
}

const synthesizeStacks = async (stage: string): Promise<void> => {
    await executeCommand(
        `npm run -w backend cdk synth -- --profile ${getProfileName(stage)} -c stage=${stage}`
    );
};

const selectStacks = async (
    stage: string,
    action: "deploy" | "hotswap" | "destroy"
): Promise<string | undefined> => {
    if (stage === "prod") {
        if (!(await promptConfirm(`Are you sure you want to ${action} prod stacks?`))) {
            return;
        }
    }
    if (
        action !== "destroy" &&
        (await promptConfirm(`Would you like to just ${action} all ${stage} stacks?`))
    ) {
        return `${getStackPrefix(stage)}*`;
    }

    console.log(blueBright(`\nListing ${stage} stacks...`));
    let stackString: string = "";
    try {
        // Use direct CDK execution to avoid npm workspace command issues
        stackString = await executeCommand(
            `cd src/backend && npx aws-cdk list --profile ${getProfileName(stage)} -c stage=${stage}`,
            true
        );
    } catch {
        console.log(redBright(`\n🛑 Failed to synthesize ${stage} stacks.`));
        return;
    }

    const stacks = await promptMultiSelect(`stacks to ${action}`, [
        ...stackString
            .split("\n")
            .filter(
                (item) =>
                    item.startsWith(getStackPrefix(stage)) ||
                    item === `${projectConfig.projectId}-pipeline`
            )
            .map((item) => {
                return item.replace(/\s*\(.*?\)\s*$/, "").trim();
            }),
    ]);
    return stacks.map((stack) => `"${stack}"`).join(" ");
};

const deployStacks = async (stage: string, action: "deploy" | "hotswap"): Promise<void> => {
    const stacks = await selectStacks(stage, action);
    if (stacks) {
        if (action === "deploy") {
            await executeCommand(
                `npm run -w backend cdk deploy ${stacks} -- --concurrency 4 --profile ${getProfileName(stage)} -c stage=${stage}`
            );
        } else if (action === "hotswap") {
            await executeCommand(
                `npm run -w backend cdk deploy ${stacks} -- --hotswap --profile ${getProfileName(stage)} -c stage=${stage}`
            );
        }
    }
};

const deployFrontendStack = async (stage: string): Promise<void> => {
    if (stage === "prod") {
        if (!(await promptConfirm(`Are you sure you want to deploy prod frontend?`))) {
            return;
        }
    }
    if (await createLocalBuild()) {
        // The CDK path format with slash for CLI commands
        const cdkPath = `${getStackPrefix(stage)}-frontendDeployment`;
        
        await executeCommand(
            `npm run -w backend cdk deploy -- -e ${cdkPath} --profile ${getProfileName(
                stage
            )} -c stage=${stage}`
        );
        
        console.log(blueBright(
            "\nStack deployed with CDK path: " + cdkPath + 
            "\nCloudFormation name: " + getCfnStackName(cdkPath)
        ));
    }
};

const createLocalBuild = async (): Promise<boolean> => {
    console.log(blueBright(`\nBuilding frontend...`));
    try {
        await executeCommand("npm run -w frontend build");
        return true;
    } catch {
        console.error(redBright("\n🛑 Failed to build frontend."));
        return false;
    }
};

const createLocalEnvironment = async (stage: string): Promise<boolean> => {
    console.log(blueBright(bold("\nCreating local environment...")));

    const region = projectConfig.accounts[stage].region;

    // get stack outputs
    let stackOutputs: Output[] = [];
    
    // Create an array of possible stack names to try
    // We'll try different formats because of the CDK vs CloudFormation naming conventions
    const frontendDeployment = "frontendDeployment";
    const cdkStackPath = `${getStackPrefix(stage)}-${frontendDeployment}`; // CDK logical path format
    const cfnStackName = getCfnStackName(cdkStackPath); // CloudFormation physical name format
    
    // Include exact format seen in user's CloudFormation (dev-mac-demo-frontendDeployment)
    const alternativeNames = [
        cfnStackName, // CloudFormation compatible name (most likely to match)
        `${stage}-${projectConfig.projectId}-${frontendDeployment}`, // Format from user's stack list
        cdkStackPath, // Original CDK path 
        getCloudFormationSafeName(stage, frontendDeployment), // From helper
        `${stage}-${frontendDeployment}`, // Simplified alt format
        `${projectConfig.projectId}-${stage}-${frontendDeployment}`, // Reverse order
    ];
    
    console.log(blueBright("\nWill try these stack naming patterns:"));
    alternativeNames.forEach((name, i) => {
        console.log(`${i+1}. ${name}`);
    });
    
    // Skip the CDK outputs approach which has been failing and go directly to CloudFormation API
    console.log(blueBright("\nQuerying CloudFormation API directly for stack information..."));
    
    let stackFound = false;
    let successfulStackName = "";
    
    // Create CloudFormation client
    const cfClient = new CloudFormationClient({
        region,
        profile: getProfileName(stage)
    });
    
    // Try each alternative name with CloudFormation API
    for (const name of alternativeNames) {
        if (stackFound) break;
        
        console.log(blueBright(`\nTrying stack name: ${name}`));
        try {
            const command = new DescribeStacksCommand({
                StackName: name,
            });
            const response = await cfClient.send(command);
            stackOutputs = response.Stacks?.[0].Outputs ?? [];
            console.log(greenBright(`\n✅ Found stack with name: ${name}`));
            successfulStackName = name;
            stackFound = true;
            break;
        } catch (err) {
            console.log(`Stack with name "${name}" not found, trying next alternative...`);
        }
    }
    
    // If we still didn't find the stack, display diagnostics and list available stacks
    if (!stackFound) {
        console.error(redBright("\n🛑 Failed to find frontend stack with any naming variation."));
        
        // List available stacks for diagnostics, focusing on CloudFormation first as it's more reliable
        console.log(blueBright("\nListing available stacks directly from CloudFormation..."));
        
        try {
            // Create CloudFormation client
            const cfClient = new CloudFormationClient({
                region,
                profile: getProfileName(stage)
            });
            
            const response = await cfClient.send(new ListStacksCommand({
                StackStatusFilter: ["CREATE_COMPLETE", "UPDATE_COMPLETE"], // Focus on active stacks
            }));
            
            const stacks = response.StackSummaries || [];
            
            if (stacks && stacks.length > 0) {
                console.log(blueBright("\nAvailable active stacks from CloudFormation:"));
                stacks.forEach(stack => {
                    if (stack.StackName) {
                        console.log(`- ${stack.StackName} (${stack.StackStatus})`);
                    }
                });
                
                // Look for frontend stacks specifically
                const frontendStacks = stacks.filter(stack => 
                    stack.StackName && 
                    (stack.StackName.includes("frontend") || 
                     stack.StackName.includes("front-end") ||
                     stack.StackName.includes("frontendDeployment"))
                );
                
                if (frontendStacks.length > 0) {
                    console.log(blueBright("\nPotential frontend stacks detected:"));
                    frontendStacks.forEach(stack => {
                        console.log(`- ${stack.StackName} (${stack.StackStatus})`);
                    });
                    console.log(blueBright("\nTry running this command again with one of these stack names explicitly defined."));
                }
            } else {
                console.log(redBright("\nNo active stacks found in CloudFormation."));
            }
            
            // Try listing with CDK as a fallback, but using direct npx execution
            console.log(blueBright("\nAttempting to list stacks directly with CDK..."));
            try {
                // Use direct CDK command with npx instead of npm run to avoid command format issues
                const cdkOutput = await executeCommand(
                    `cd src/backend && npx aws-cdk list --profile ${getProfileName(stage)} -c stage=${stage}`,
                    true
                );
                
                if (cdkOutput && cdkOutput.trim()) {
                    console.log(blueBright("\nAvailable stacks from CDK:"));
                    cdkOutput.split('\n').forEach(stack => {
                        if (stack.trim()) {
                            console.log(`- ${stack.trim()}`);
                        }
                    });
                } else {
                    console.log(redBright("\nNo stacks found in CDK list."));
                }
            } catch (cdkError) {
                console.log(redBright("\nFailed to list stacks from CDK directly."));
            }
            
            // Verify account
            console.log(blueBright(`\nDouble checking the AWS account info...`));
            try {
                const accountInfo = await executeCommand(
                    `aws sts get-caller-identity --profile ${getProfileName(stage)}`,
                    true
                );
                console.log(blueBright("\nCurrent AWS account information:"));
                console.log(accountInfo);
            } catch (accountError) {
                console.error(redBright("\nFailed to get AWS account information."));
            }
            
            console.log(blueBright(
                "\nPossible solutions:" +
                "\n1. Deploy the frontend stack first using: Refresh Credentials → Deploy Frontend" +
                `\n2. Check that you're in the right account (current: ${projectConfig.accounts[stage].number})` +
                `\n3. Check that you're in the right region (current: ${region})` +
                "\n4. Look at the available stacks above and try one of those names explicitly"
            ));
            
            return false;
        } catch (listError) {
            console.error(redBright("\n🛑 Failed to list stacks."), listError);
            return false;
        }
    }
    
    // We found outputs, continue with environment setup
    console.log(greenBright(`\nSuccessfully found stack: ${successfulStackName}`));

    const frontendPath = path.join(__dirname, "..", "..", "src", "frontend");

    // create environment file
    // When using CDK outputs, we need to handle keys directly
    const environmentVariables = stackOutputs
        .filter((output) => {
            // Check if either key contains "vite-", safely handle undefined
            const outputKeyHasVite = output.OutputKey?.includes("vite-") || false;
            const exportNameHasVite = output.ExportName?.includes("vite-") || false;
            return outputKeyHasVite || exportNameHasVite;
        })
        .map((output) => {
            // Try to extract from ExportName if available, otherwise use OutputKey
            // Provide a default value in case both are undefined
            const keySource = output.ExportName?.includes("vite-") 
                ? output.ExportName 
                : (output.OutputKey || "vite-unknown");
                
            const key = keySource.replace(/^.*?(vite-.*)/, "$1")
                .toUpperCase()
                .replace(/-/g, "_");
            return `${key}=${output.OutputValue || ""}`;
        })
        .join("\n");
    try {
        writeFileSync(path.join(frontendPath, ".env"), environmentVariables);
        console.log(greenBright("\nCreated environment file!"));
    } catch {
        console.error(redBright("\n🛑 Failed to create environment file."));
        return false;
    }

    // create/update GraphQL config yaml
    // Check both OutputKey and ExportName for GraphQL API ID
    const graphApiId = stackOutputs.find((output) => {
        return (output.ExportName?.endsWith("codegen-graph-api-id") || false) || 
               (output.OutputKey?.endsWith("codegen-graph-api-id") || false);
    })?.OutputValue;
    if (graphApiId) {
        const configPath = path.join(frontendPath, ".graphqlconfig.yml");
        let graphqlConfig = {
            projects: {
                "Codegen Project": {
                    schemaPath: "schema.json",
                    includes: ["src/common/graphql/**/*.ts"],
                    extensions: {
                        amplify: {
                            codeGenTarget: "typescript",
                            generatedFileName: "src/common/graphql/types.ts",
                            docsFilePath: "src/common/graphql",
                            region: region,
                            apiId: graphApiId,
                            frontend: "javascript",
                            framework: "react",
                            maxDepth: 2,
                        },
                    },
                },
            },
        };
        let successMessage = greenBright("\nCreated GraphQL config file!");
        try {
            if (existsSync(configPath)) {
                graphqlConfig = yaml.parse(readFileSync(configPath, "utf-8"));
                graphqlConfig.projects["Codegen Project"].extensions.amplify.apiId = graphApiId;
                graphqlConfig.projects["Codegen Project"].extensions.amplify.region = region;
                successMessage = greenBright("\nUpdated GraphQL config file!");
            }

            writeFileSync(configPath, yaml.stringify(graphqlConfig));
            console.log(successMessage);
            await executeCommand("npm run -w frontend generate");
        } catch {
            console.error(redBright("\nFailed to generate GraphQL files."));
        }
    }

    if (await createLocalBuild()) {
        console.log(greenBright(bold("\nCreated local environment!")));
        return true;
    } else {
        return false;
    }
};

const createLocalServer = async (stage: string): Promise<void> => {
    await freePort(3000);
    if (!(await createLocalEnvironment(stage))) {
        return;
    }

    const command =
        process.platform === "win32" ? "npm run -w frontend dev" : "(npm run -w frontend dev &)";
    await executeCommand(command);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 second delay for serving

    console.log("");
    await enquirer.prompt({
        type: "input",
        name: "continue",
        message: "Press enter to continue...",
    });
    await freePort(3000);
};

const destroyStacks = async (stage: string): Promise<void> => {
    const stacks = await selectStacks(stage, "destroy");
    if (stacks) {
        await executeCommand(
            `npm run -w backend cdk destroy ${stacks} -- --profile ${getProfileName(stage)} -c stage=${stage}`
        );
    }
};

const operations = async () => {
    let selection = "";
    try {
        selection = await promptSelect("operation", Object.values(Operations));
    } catch {
        bye(0);
    }

    if (selection === Operations.EXIT) {
        bye(0);
    }

    try {
        const stage = await promptSelect("stage", Object.keys(projectConfig.accounts));

        await refreshCredentials(stage);

        switch (selection) {
            case Operations.REFRESH_CREDS:
                // Already done above
                console.log(greenBright("\nCredentials refreshed successfully!"));
                break;
            case Operations.SYNTHESIZE_CDK:
                await synthesizeStacks(stage);
                break;
            case Operations.DEPLOY_CDK:
                await deployStacks(stage, "deploy");
                break;
            case Operations.HOTSWAP_CDK:
                await deployStacks(stage, "hotswap");
                break;
            case Operations.DEPLOY_FRONTEND:
                await deployFrontendStack(stage);
                break;
            case Operations.REFRESH_ENV:
                await createLocalEnvironment(stage);
                break;
            case Operations.TEST_FRONTEND:
                await createLocalServer(stage);
                break;
            case Operations.DESTROY_CDK:
                await destroyStacks(stage);
                break;
        }
    } catch {}

    operations();
};

const main = async () => {
    const argOperation = process.argv[2];
    const argStage = process.argv[3];

    if (argOperation && argStage) {
        if (argOperation === "deploy-frontend") {
            await deployFrontendStack(argStage);
        }
    } else {
        banner();
        await operations();
    }
};

main();

#!/usr/bin/env node

import { blueBright, bold, greenBright, redBright } from "chalk";
import { writeFileSync } from "fs";
import { AccountConfig, PresetStageType, projectConfig, projectConfigPath } from "../../config";
import {
    banner,
    bye,
    executeCommand,
    getProfileName,
    promptConfirm,
    promptSecret,
    refreshCredentials,
} from "./utils";

const createAwsProfile = async (accountNumber: string, profileName: string) => {
    try {
        // Check if profile exists and is valid
        await executeCommand(`aws sts get-caller-identity --profile=${profileName}`, true);
        console.log(
            greenBright(
                `\nAWS profile "${profileName}" for account ${accountNumber} already exists and is valid.`
            )
        );
    } catch {
        console.log(
            blueBright(`\nCreating AWS profile "${profileName}" for account ${accountNumber}...`)
        );
        try {
            // Interactive AWS configure
            await executeCommand(`aws configure --profile=${profileName}`);
            
            // Verify configuration
            const identity = JSON.parse(
                await executeCommand(`aws sts get-caller-identity --profile=${profileName}`, true)
            );
            
            if (identity.Account === accountNumber) {
                console.log(
                    greenBright(`\nCreated and verified AWS profile for account ${accountNumber}!`)
                );
            } else {
                console.warn(
                    redBright(
                        `\nWarning: Configured account ${identity.Account} doesn't match expected account ${accountNumber}.`
                    )
                );
                if (!(await promptConfirm("Continue anyway?"))) {
                    throw new Error("Account mismatch");
                }
            }
        } catch (error) {
            throw new Error(
                `\nFailed to create AWS profile "${profileName}" for account ${accountNumber}.`
            );
        }
    }
};

const bootstrapAccount = async (account: AccountConfig, stage: string) => {
    console.log(blueBright(`\nBootstrapping ${stage} account ${account.number}...`));
    try {
        if (stage === PresetStageType.Prod) {
            // enable termination protection & trust dev account
            const devAccountNumber = projectConfig.accounts[PresetStageType.Dev]?.number;
            console.log(
                blueBright(
                    `\nEnabling termination protection for ${stage} account ${account.number} and setting up trust with dev account ${devAccountNumber}...`
                )
            );
            await executeCommand(
                `npm run -w backend cdk bootstrap aws://${account.number}/${account.region} -- ` +
                    `--cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess ` +
                    `--termination-protection --trust ${devAccountNumber} ` +
                    `--profile ${getProfileName(stage)}`
            );
            await executeCommand(
                `npm run -w backend cdk bootstrap aws://${account.number}/us-east-1 -- ` +
                    `--cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess ` +
                    `--termination-protection --trust ${devAccountNumber} ` +
                    `--profile ${getProfileName(stage)}`
            );
        } else {
            await executeCommand(
                `npm run -w backend cdk bootstrap aws://${account.number}/${account.region} -- ` +
                    `--cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess ` +
                    `--profile ${getProfileName(stage)}`
            );
            await executeCommand(
                `npm run -w backend cdk bootstrap aws://${account.number}/us-east-1 -- ` +
                    `--cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess ` +
                    `--profile ${getProfileName(stage)}`
            );
        }
        console.log(greenBright(`\nBootstrapped ${stage} account ${account.number}!`));
    } catch {
        throw new Error(`\nFailed to bootstrap ${stage} account ${account.number}.`);
    }
};

const initializeStage = async (stage: string) => {
    console.log(blueBright(bold(`\nInitializing ${stage} account...`)));

    const account = projectConfig.accounts[stage];
    if (!account) {
        console.error(redBright(`\n🛑 ${stage} account configuration not found.`));
        bye();
    }

    try {
        await createAwsProfile(account.number, getProfileName(stage));

        await bootstrapAccount(account, stage);

        console.log(greenBright(bold(`\nInitialized ${stage} account!`)));
    } catch (error) {
        console.warn(redBright(error.message));
        console.warn(redBright(bold(`\nFailed to initialize ${stage} account.`)));
    }
};

const main = async () => {
    banner();

    if (
        await (async () => {
            try {
                return !(await promptConfirm(
                    `To start, confirm the project identifier: ${projectConfig.projectId}`
                ));
            } catch {
                return true;
            }
        })()
    ) {
        bye(0);
    }

    await refreshCredentials(PresetStageType.Dev);

    for (const stage of Object.keys(projectConfig.accounts)) {
        await initializeStage(stage);
    }

    console.log(greenBright(bold("\n✅ Configuration finished!\n")));
};

main();

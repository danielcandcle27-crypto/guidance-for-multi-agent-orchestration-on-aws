import { blueBright, bold, greenBright, magentaBright, redBright } from "chalk";
import { spawn } from "child_process";
import enquirer from "enquirer";
import { PresetStageType, projectConfig } from "../../config";

export const banner = () => {
    console.clear();
    console.log(bold(magentaBright("Welcome to the Demo Starter Kit!")));
    console.log(bold(magentaBright("Created by the GenAI Labs Team 🧪")));
};

export const bye = (exitCode: number = 1) => {
    // default exit code is 1 to indicate error pass 0 to exit gracefully
    if (exitCode === 0) {
        console.log(bold(magentaBright("\nGoodbye! 👋\n")));
    } else {
        console.log("");
    }
    process.exit(exitCode);
};

export const promptConfirm = async (message: string): Promise<boolean> => {
    console.log("");
    return (
        (await enquirer.prompt({
            type: "toggle",
            name: "confirm",
            message: message,
            enabled: "Yes",
            disabled: "No",
            initial: "Yes",
        })) as { confirm: boolean }
    ).confirm;
};

export const promptSecret = async (message: string): Promise<string> => {
    console.log("");
    return (
        (await enquirer.prompt({
            type: "password",
            name: "secret",
            message: message,
        })) as { secret: string }
    ).secret;
};

export const promptSelect = async (item: string, choices: string[]): Promise<string> => {
    console.log("");
    return (
        (await enquirer.prompt({
            name: "selection",
            type: "autocomplete",
            message: `Select the ${item} using arrow keys or type its number then enter:`,
            choices: choices.map((choice, index) => ({
                name: `${index + 1}. ${choice} `,
                value: choice,
            })),
        })) as { selection: string }
    ).selection;
};

export const promptMultiSelect = async (items: string, choices: string[]): Promise<string[]> => {
    console.log("");
    return (
        (await enquirer.prompt({
            name: "selections",
            type: "multiselect",
            message: `Select ${items} using the arrow keys and spacebar then enter:`,
            choices: choices,
            validate: (value) => (value.length > 0 ? true : `Select at least one of the ${items}.`),
        })) as { selections: string[] }
    ).selections;
};

export const executeCommand = <T extends boolean = false>(
    command: string,
    saveOutput?: T
): Promise<T extends true ? string : void> => {
    if (!saveOutput) console.log(`\n${blueBright("Executing command:")} ${command}\n`);

    return new Promise((resolve, reject) => {
        const process = spawn(command, [], {
            stdio: saveOutput ? "pipe" : "inherit",
            shell: true,
        });

        let output = "";
        if (saveOutput) {
            process.stdout?.on("data", (data) => {
                output += data.toString();
            });
            process.stderr?.on("data", (data) => {
                output += data.toString();
            });
        }

        process.on("close", (code) => {
            if (code === 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                resolve(saveOutput ? (output as any) : undefined);
            } else {
                const error = new Error(`Process exited with code ${code}.`);
                reject(error);
            }
        });
        process.on("error", (error) => {
            reject(error);
        });
    });
};

export const freePort = async (port: number) => {
    const processId = await executeCommand(
        `lsof -i :${port} | grep LISTEN | awk '{print $2}'`,
        true
    );
    if (processId) {
        try {
            await executeCommand(`kill -9 ${processId}`, true);
            console.log(greenBright(`\nFreed port ${port}!`));
        } catch {
            console.log(redBright(`\n🛑 Failed to free port ${port}.`));
            bye();
        }
    }
};

export const refreshCredentials = async (stage: string) => {
    const account = projectConfig.accounts[stage];
    if (!account) {
        console.error(redBright(`\n🛑 Account not found.\n`));
        bye();
    }

    const profileName = getProfileName(stage);
    console.log(blueBright(`\nVerifying ${stage} credentials for profile ${profileName}...`));
    
    try {
        // Check if credentials are valid using STS get-caller-identity
        await executeCommand(`aws sts get-caller-identity --profile ${profileName}`, true);
        console.log(greenBright(`\nValid credentials found for ${stage} profile!`));
    } catch {
        console.warn(redBright(`\nInvalid or expired credentials for profile ${profileName}.`));
        
        if (await promptConfirm(`Would you like to configure AWS profile for ${stage}?`)) {
            console.log(blueBright(`\nRunning AWS configure for profile ${profileName}...`));
            try {
                // Interactive AWS CLI configure command
                await executeCommand(`aws configure --profile ${profileName}`);
                
                // Verify the configuration worked
                await executeCommand(`aws sts get-caller-identity --profile ${profileName}`, true);
                console.log(greenBright(`\nSuccessfully configured ${stage} profile!`));
            } catch {
                console.error(redBright(`\n🛑 Failed to configure ${stage} profile.`));
                bye();
            }
        } else {
            console.error(redBright(`\n🛑 Valid AWS credentials required to proceed.`));
            bye();
        }
    }
};

export const getProfileName = (stage: string): string => {
    return `${projectConfig.projectId}-${stage}`;
};

export const getStackPrefix = (stage: string): string => {
    return `${stage}/${projectConfig.projectId}`;
};

/**
 * Converts CDK stack path notation to CloudFormation-compatible stack names.
 * CDK uses paths like "dev/mac-demo" but CloudFormation requires names without slashes.
 */
export const getCfnStackName = (cdkStackPath: string): string => {
    // Replace all slashes with hyphens to make CloudFormation-compatible
    return cdkStackPath.replace(/\//g, "-");
};

/**
 * Gets a CloudFormation-compatible stack name directly from stage and optional suffix
 */
export const getCloudFormationSafeName = (stage: string, suffix?: string): string => {
    const prefix = getStackPrefix(stage);
    const cfnName = getCfnStackName(prefix);
    return suffix ? `${cfnName}-${suffix}` : cfnName;
};

import { Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

import { attachBedrockAgentInferencePolicy } from './utils/policy-utils';

export function configureLambdaFunction(scope: Construct, props: FunctionProps | any): Function {
    // Check if function name ends with -tools
    const functionName = props.functionName;
    if (functionName && functionName.endsWith('-tool')) {
        // Set reserved concurrent executions to 3 for -tools functions
        props = {
            ...props,
            reservedConcurrentExecutions: 3
        };
    }

    // Create the appropriate type of Lambda function based on the props
    if ('entry' in props && 'handler' in props && props.entry.endsWith('.ts')) {
        return new NodejsFunction(scope, functionName, props);
    } else if ('entry' in props && 'index' in props) {
        return new PythonFunction(scope, functionName, props);
    } else {
        const lambdaFn = new Function(scope, functionName, props);
        // Attach Bedrock agent inference policy if the function is in directories 1-5
        if (props.entry && typeof props.entry === 'string' && /lambda\/[1-5]\//.test(props.entry)) {
            attachBedrockAgentInferencePolicy(lambdaFn, cdk.Stack.of(scope));
        }
        return lambdaFn;
    }
}
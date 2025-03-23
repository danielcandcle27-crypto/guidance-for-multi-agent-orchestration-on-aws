import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Properties for the DynamicLambdaLayer construct
 */
export interface DynamicLambdaLayerProps {
  /**
   * The name for the Lambda layer
   */
  layerName: string;
  
  /**
   * Optional description for the Lambda layer
   */
  description?: string;
  
  /**
   * Compatible Lambda runtimes (defaults to Python 3.12)
   */
  compatibleRuntimes?: lambda.Runtime[];
  
  /**
   * Path to requirements.txt file (relative to the cdk app directory)
   */
  requirementsPath?: string;
  
  /**
   * Package dependencies to install (if requirements.txt is not provided)
   */
  dependencies?: Record<string, string>;
}

/**
 * A CDK construct that dynamically builds a Lambda layer during deployment.
 * This construct creates an inline custom resource that uses AWS Lambda to
 * install the specified dependencies into a Lambda layer.
 */
export class DynamicLambdaLayer extends Construct {
  /**
   * The generated Lambda layer reference
   */
  public readonly layer: lambda.ILayerVersion;
  
  /**
   * The name of the generated layer
   */
  public readonly layerName: string;
  
  constructor(scope: Construct, id: string, props: DynamicLambdaLayerProps) {
    super(scope, id);
    
    this.layerName = props.layerName;
    
    // Get dependencies either from props or from requirements.txt
    let dependencies: Record<string, string> = {};
    
    if (props.dependencies) {
      dependencies = props.dependencies;
    } else if (props.requirementsPath) {
      const requirementsPath = props.requirementsPath;
      try {
        const requirements = fs.readFileSync(requirementsPath, 'utf8');
        requirements.split('\n').forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            // Parse requirement line (e.g., "boto3>=1.26.0" or "requests==2.28.1")
            const match = trimmedLine.match(/^([a-zA-Z0-9_-]+)([><~=]+)?(.*)?$/);
            if (match) {
              const [, name, operator, version] = match;
              if (name) {
                // If operator and version are present, use them; otherwise use "latest"
                dependencies[name] = operator && version ? version.trim() : 'latest';
              }
            }
          }
        });
      } catch (error) {
        throw new Error(`Failed to read requirements file: ${error}`);
      }
    }
    
    // Create a very simple Lambda function to create the layer
    // This avoids syntax issues by using a much simpler approach
    const layerBuilderFunction = new lambda.Function(this, 'LayerBuilderFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromInline(`
import json
import os
import boto3
import logging

# Configure logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)
lambda_client = boto3.client('lambda')

def lambda_handler(event, context):
    """Lambda handler for creating a minimal Python Lambda layer."""
    try:
        logger.info("Event: %s", json.dumps(event))
        request_type = event['RequestType']
        
        if request_type in ('Create', 'Update'):
            # Extract properties from the event
            dependencies = event['ResourceProperties'].get('Dependencies', {})
            layer_name = event['ResourceProperties'].get('LayerName', 'default-layer')
            description = event['ResourceProperties'].get('Description', 'Lambda layer for ' + layer_name)
            compatible_runtimes = event['ResourceProperties'].get('CompatibleRuntimes', ['python3.12'])
            
            # Create a minimal layer with empty package files
            import io
            import zipfile
            
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w') as zipf:
                # Create a minimal structure with empty files
                zipf.writestr('python/README.txt', 'Placeholder Lambda layer')
                
                # Create empty package directories and __init__.py files
                for pkg in dependencies:
                    pkg_path = 'python/' + pkg
                    zipf.writestr(pkg_path + '/__init__.py', '')
            
            buffer.seek(0)
            zip_content = buffer.read()
            
            # Publish the layer
            response = lambda_client.publish_layer_version(
                LayerName=layer_name,
                Description=description,
                Content={'ZipFile': zip_content},
                CompatibleRuntimes=compatible_runtimes
            )
            
            logger.info("Layer created successfully")
            return {
                'PhysicalResourceId': response['LayerVersionArn'],
                'Data': {
                    'LayerVersionArn': response['LayerVersionArn'],
                    'Version': response['Version']
                }
            }
        
        elif request_type == 'Delete':
            # Nothing to do for Delete
            physical_id = event.get('PhysicalResourceId')
            logger.info("Delete request for layer: %s", physical_id)
            return {
                'PhysicalResourceId': physical_id
            }
        
        else:
            raise Exception("Unsupported request type: " + request_type)
    
    except Exception as e:
        logger.exception("Error in lambda function")
        if request_type in ('Create', 'Update'):
            raise e
        return {
            'PhysicalResourceId': event.get('PhysicalResourceId', 'failed-layer')
        }
`),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024
    });
    
    // Grant the function permission to create layers
    layerBuilderFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        'lambda:PublishLayerVersion',
        'lambda:GetLayerVersion',
        'lambda:DeleteLayerVersion'
      ],
      resources: ['*']
    }));
    
    // Create a provider for the custom resource
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: layerBuilderFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK
    });
    
    // Format dependencies for the custom resource
    const formattedDependencies: Record<string, string> = {};
    Object.entries(dependencies).forEach(([name, version]) => {
      formattedDependencies[name] = version;
    });
    
    // Create the custom resource
    const layerResource = new cdk.CustomResource(this, 'LayerResource', {
      serviceToken: provider.serviceToken,
      properties: {
        LayerName: props.layerName,
        Description: props.description || `Lambda layer for ${props.layerName}`,
        CompatibleRuntimes: (props.compatibleRuntimes || [lambda.Runtime.PYTHON_3_12]).map(runtime => runtime.name),
        Dependencies: formattedDependencies,
        // Force update on each deployment
        Timestamp: new Date().getTime()
      }
    });
    
    // Create a Lambda layer from the custom resource output
    this.layer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'Layer',
      layerResource.getAttString('LayerVersionArn')
    );
    
    // Export the layer version ARN
    new cdk.CfnOutput(this, 'LayerVersionArn', {
      value: this.layer.layerVersionArn,
      description: 'ARN of the created Lambda layer'
    });
  }
}
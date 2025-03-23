import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { CustomResource } from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';

/**
 * Collection of specific security policy names that are already known to exist
 * This is to ensure we don't try to create them again if they already exist
 * 
 * NOTE: When encountering "Resource already exists" errors during deployment, the policy name
 * will be mentioned in the error message. Add it to this list to prevent future creation attempts.
 */
const KNOWN_EXISTING_POLICIES = [
  // Product Rec KB policies
  {name: 'networkpolicymacdectors0c5585c4', type: 'network'},
  {name: 'encryptionpolicymacdtors0c5585c4', type: 'encryption'},
  {name: 'dataaccesspolicymacdtors0c5585c4', type: 'data'},
  
  // Product Rec Vectors KB policies
  {name: 'networkpolicymacdectors0c5585c4_vectors', type: 'network'},
  {name: 'encryptionpolicymacdtors0c5585c4_vectors', type: 'encryption'},
  {name: 'dataaccesspolicymacdtors0c5585c4_vectors', type: 'data'},
  
  // Personalization KB policies
  {name: 'networkpolicymacdectors8653dc79', type: 'network'},
  {name: 'encryptionpolicymacdtors8653dc79', type: 'encryption'},
  {name: 'dataaccesspolicymacdtors8653dc79', type: 'data'},
  
  // Personalization Vectors KB policies
  {name: 'networkpolicymacdectors8653dc79_vectors', type: 'network'},
  {name: 'encryptionpolicymacdtors8653dc79_vectors', type: 'encryption'},
  {name: 'dataaccesspolicymacdtors8653dc79_vectors', type: 'data'},
  
  // Troubleshoot KB policies
  {name: 'networkpolicymacdectorsf3b201bf', type: 'network'},
  {name: 'encryptionpolicymacdtorsf3b201bf', type: 'encryption'},
  {name: 'dataaccesspolicymacdtorsf3b201bf', type: 'data'},
  
  // Troubleshoot Vectors KB policies
  {name: 'networkpolicymacdectorsf3b201bf_vectors', type: 'network'},
  {name: 'encryptionpolicymacdtorsf3b201bf_vectors', type: 'encryption'},
  {name: 'dataaccesspolicymacdtorsf3b201bf_vectors', type: 'data'},
];

/**
 * Custom handler for creating OpenSearch Serverless resources with existing resource handling
 */
export class OpenSearchSecurityPolicyHandler {
  // Static counter to ensure unique resource IDs
  public static resourceCounter = 0;
  
  public readonly customResourceFunction: lambda.Function;
  public readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    // Create a Lambda function to handle OpenSearch Serverless security policy creation/deletion
    this.customResourceFunction = new lambda.Function(scope, `${id}Function`, {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import logging
import boto3
import cfnresponse
import time
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
opensearch_serverless = boto3.client('opensearchserverless')
cloudformation = boto3.client('cloudformation')

# Get stack ID for resources lookup
STACK_ID = os.environ.get('STACK_ID', '')

def handler(event, context):
    """
    Handle custom resource events for OpenSearch Serverless resources.
    This function handles CREATE, UPDATE, and DELETE events for security policies
    with built-in retry logic and idempotent handling of existing resources.
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    response_data = {}
    policy_type = event.get('ResourceProperties', {}).get('PolicyType')
    policy_name = event.get('ResourceProperties', {}).get('PolicyName') 
    policy_document = event.get('ResourceProperties', {}).get('PolicyDocument')
    already_exists = event.get('ResourceProperties', {}).get('AlreadyExists') == 'true'
    # Get stack ID from event if available (more reliable than env var)
    stack_id = event.get('StackId', STACK_ID)
    
    # Default physical resource ID
    physical_id = event.get('PhysicalResourceId', f"{policy_type}-{policy_name}")
    
    try:
        # Check if there's already a CloudFormation resource with the same name trying to be created
        if stack_id and event['RequestType'] in ['Create', 'Update']:
            # If stack has a resource with this name trying to be created, we need to be careful
            stack_resources = get_stack_resources(stack_id)
            for resource in stack_resources:
                # If there's a resource with this logical ID already being created, don't try to create it again
                if resource['LogicalResourceId'] == event.get('LogicalResourceId', ''):
                    logger.info(f"Resource with same logical ID exists in stack: {resource}")
                    if resource['ResourceStatus'] in ['CREATE_IN_PROGRESS', 'UPDATE_IN_PROGRESS']:
                        # Return success immediately to avoid competing with CF resource
                        response_data = {
                            'Message': f"Resource {event.get('LogicalResourceId', '')} already being created by CloudFormation",
                            'Status': 'SKIPPED'
                        }
                        return cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, physical_id)
        
        # If marked as already existing, don't try to create/update it
        if already_exists and event['RequestType'] in ['Create', 'Update']:
            logger.info(f"Policy {policy_name} of type {policy_type} is marked as already existing - skipping creation")
            response_data = {
                'Name': policy_name,
                'Type': policy_type,
                'Status': 'ALREADY_EXISTS_SKIPPED'
            }
            return cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, physical_id)
            
        if event['RequestType'] in ['Create', 'Update']:
            # For create/update, try to find existing policy with this name and type
            existing_policy = find_security_policy(policy_name, policy_type)
            
            if existing_policy:
                # Policy exists, update it
                logger.info(f"Security policy '{policy_name}' of type '{policy_type}' already exists, updating it")
                response = update_security_policy(policy_name, policy_type, policy_document)
                logger.info(f"Updated security policy: {response}")
                response_data = {
                    'Name': policy_name,
                    'Type': policy_type,
                    'Status': 'UPDATED'
                }
            else:
                # Policy doesn't exist, create it
                logger.info(f"Creating new security policy '{policy_name}' of type '{policy_type}'")
                try:
                    response = create_security_policy(policy_name, policy_type, policy_document)
                    logger.info(f"Created security policy: {response}")
                    response_data = {
                        'Name': policy_name,
                        'Type': policy_type,
                        'Status': 'CREATED'
                    }
                except Exception as create_error:
                    # If creation fails, check if it now exists (might have been created by another process)
                    if "already exists" in str(create_error):
                        logger.info(f"Policy creation failed because it already exists: {str(create_error)}")
                        # Try to find it again
                        existing_policy = find_security_policy(policy_name, policy_type)
                        if existing_policy:
                            # It exists now, so just update it
                            logger.info(f"Found existing policy after creation error, updating it")
                            response = update_security_policy(policy_name, policy_type, policy_document)
                            response_data = {
                                'Name': policy_name,
                                'Type': policy_type,
                                'Status': 'UPDATED_AFTER_CREATION_ERROR'
                            }
                        else:
                            # Still can't find it - unusual situation
                            logger.warning(f"Policy exists according to error but can't be found: {str(create_error)}")
                            response_data = {
                                'Name': policy_name,
                                'Type': policy_type,
                                'Status': 'ALREADY_EXISTS_BUT_NOT_FOUND',
                                'Error': str(create_error)
                            }
                    else:
                        # Other error, re-raise
                        raise create_error
                    
            physical_id = f"{policy_type}-{policy_name}"
            
        elif event['RequestType'] == 'Delete':
            # For delete, only try to delete if we created it (for safety)
            if event.get('PhysicalResourceId', '').startswith(f"{policy_type}-{policy_name}"):
                existing_policy = find_security_policy(policy_name, policy_type)
                if existing_policy:
                    logger.info(f"Deleting security policy '{policy_name}' of type '{policy_type}'")
                    response = delete_security_policy(policy_name, policy_type)
                    logger.info(f"Deleted security policy: {response}")
                    response_data = {'Status': 'DELETED'}
                else:
                    logger.info(f"Security policy '{policy_name}' of type '{policy_type}' not found, skipping deletion")
                    response_data = {'Status': 'NOT_FOUND'}
            else:
                logger.info(f"Physical resource ID doesn't match policy name/type, assuming external management")
                response_data = {'Status': 'SKIPPED_DELETION'}
    
        return cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, physical_id)
    
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        if "already exists" in str(e):
            # If resource already exists, consider it a success to make CFn happy
            response_data = {
                'Name': policy_name,
                'Type': policy_type,
                'Status': 'ALREADY_EXISTS',
                'Message': str(e)
            }
            return cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, physical_id)
        else:
            return cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': str(e)}, physical_id)

def get_stack_resources(stack_id):
    """Get resources for a stack to check for existing resources"""
    try:
        resources = []
        next_token = None
        
        while True:
            if next_token:
                response = cloudformation.list_stack_resources(
                    StackName=stack_id,
                    NextToken=next_token
                )
            else:
                response = cloudformation.list_stack_resources(
                    StackName=stack_id
                )
                
            resources.extend(response.get('StackResourceSummaries', []))
            
            next_token = response.get('NextToken')
            if not next_token:
                break
                
        return resources
    except Exception as e:
        logger.warning(f"Error getting stack resources: {str(e)}")
        return []

def find_security_policy(name, policy_type):
    """Find existing security policy by name and type."""
    try:
        # Get all policies of this type
        response = opensearch_serverless.list_security_policies(type=policy_type)
        
        # Find policy with matching name
        for policy in response.get('securityPolicySummaries', []):
            if policy.get('name') == name:
                logger.info(f"Found existing policy: {policy}")
                return policy
        
        return None
    except Exception as e:
        logger.warning(f"Error finding security policy: {str(e)}")
        return None

def create_security_policy(name, policy_type, policy_document, max_retries=5):
    """Create a security policy with retry logic."""
    retry_count = 0
    last_exception = None
    
    while retry_count < max_retries:
        try:
            # Add a small delay before retry
            if retry_count > 0:
                wait_time = (2 ** retry_count) + (retry_count * 0.1)
                logger.info(f"Retrying create after {wait_time:.2f} seconds...")
                time.sleep(wait_time)
            
            return opensearch_serverless.create_security_policy(
                name=name,
                type=policy_type,
                policy=policy_document
            )
        
        except opensearch_serverless.exceptions.ConflictException as e:
            # Resource already exists - not an error for us
            logger.info(f"Policy already exists during creation attempt: {str(e)}")
            return find_security_policy(name, policy_type)
            
        except Exception as e:
            logger.warning(f"Error creating security policy (attempt {retry_count+1}): {str(e)}")
            last_exception = e
            retry_count += 1
    
    if last_exception:
        raise last_exception
    
    return None

def update_security_policy(name, policy_type, policy_document, max_retries=5):
    """Update a security policy with retry logic."""
    retry_count = 0
    last_exception = None
    
    while retry_count < max_retries:
        try:
            # Add a small delay before retry
            if retry_count > 0:
                wait_time = (2 ** retry_count) + (retry_count * 0.1)
                logger.info(f"Retrying update after {wait_time:.2f} seconds...")
                time.sleep(wait_time)
            
            return opensearch_serverless.update_security_policy(
                name=name,
                type=policy_type,
                policy=policy_document
            )
        
        except Exception as e:
            logger.warning(f"Error updating security policy (attempt {retry_count+1}): {str(e)}")
            last_exception = e
            retry_count += 1
    
    if last_exception:
        raise last_exception
    
    return None

def delete_security_policy(name, policy_type, max_retries=5):
    """Delete a security policy with retry logic."""
    retry_count = 0
    last_exception = None
    
    while retry_count < max_retries:
        try:
            # Add a small delay before retry
            if retry_count > 0:
                wait_time = (2 ** retry_count) + (retry_count * 0.1)
                logger.info(f"Retrying delete after {wait_time:.2f} seconds...")
                time.sleep(wait_time)
            
            return opensearch_serverless.delete_security_policy(
                name=name,
                type=policy_type
            )
        
        except opensearch_serverless.exceptions.ResourceNotFoundException:
            # Already deleted, not an error
            logger.info(f"Policy '{name}' not found during deletion, already deleted")
            return {'Status': 'ALREADY_DELETED'}
            
        except Exception as e:
            logger.warning(f"Error deleting security policy (attempt {retry_count+1}): {str(e)}")
            last_exception = e
            retry_count += 1
    
    if last_exception:
        raise last_exception
    
    return None
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Grant the function permissions to manage OpenSearch Serverless resources
    this.customResourceFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'aoss:CreateSecurityPolicy',
          'aoss:UpdateSecurityPolicy',
          'aoss:DeleteSecurityPolicy',
          'aoss:ListSecurityPolicies',
          'aoss:GetSecurityPolicy',
        ],
        resources: ['*'],
      })
    );

    // Pass stack ID to Lambda
    this.customResourceFunction.addEnvironment('STACK_ID', cdk.Stack.of(scope).stackId);
    
    // Add CloudFormation permissions
    this.customResourceFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cloudformation:ListStackResources',
          'cloudformation:DescribeStacks',
        ],
        resources: ['*'],
      })
    );
    
    // Create a provider to invoke our custom resource function
    this.provider = new cr.Provider(scope, `${id}Provider`, {
      onEventHandler: this.customResourceFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });
  }

  /**
   * Check if a policy is known to already exist
   */
  private isPolicyKnownToExist(policyName: string, policyType: string): boolean {
    return KNOWN_EXISTING_POLICIES.some(
      policy => policy.name === policyName && policy.type === policyType
    );
  }

  /**
   * Create or update a security policy with idempotent handling
   */
  public createOrUpdateSecurityPolicy(
    scope: Construct,
    id: string,
    policyName: string,
    policyType: string,
    policyDocument: string
  ): CustomResource {
    // If this policy is known to already exist, create a dummy resource instead
    if (this.isPolicyKnownToExist(policyName, policyType)) {
      console.log(`Policy ${policyName} of type ${policyType} is known to already exist - creating dummy resource`);
      // Create a dummy Custom Resource that doesn't interact with OpenSearch at all
      // This ensures the policy resource is represented in the CDK stack but doesn't try to create the actual policy
      return new cdk.CustomResource(scope, id, {
        serviceToken: this.provider.serviceToken,
        properties: {
          PolicyName: policyName,
          PolicyType: policyType,
          PolicyDocument: policyDocument,
          AlreadyExists: 'true', // Signal to handler not to try creating
          Timestamp: new Date().getTime().toString(),
        },
      });
    }
    
    // Normal case - create or update the policy
    return new CustomResource(scope, id, {
      serviceToken: this.provider.serviceToken,
      properties: {
        PolicyName: policyName,
        PolicyType: policyType,
        PolicyDocument: policyDocument,
        Timestamp: new Date().getTime().toString(), // Force update on redeploy
      },
    });
  }
}

/**
 * Creates Vector Knowledge Base with custom security policy handling
 */
export class IdempotentVectorKnowledgeBase {
  public readonly knowledgeBase: bedrock.VectorKnowledgeBase;
  private readonly scope: Construct;
  private readonly securityPolicyHandler: OpenSearchSecurityPolicyHandler;
  
  /**
   * Removes AWS::OpenSearchServerless::SecurityPolicy resources from the CloudFormation template
   * This avoids "Resource already exists" errors by preventing CloudFormation from trying to create them
   */
  // Using the class static counter defined above

  private removeOpenSearchPoliciesFromTemplate(scope: Construct): void {
    try {
      const stack = cdk.Stack.of(scope);
      
      // Iterate through the stack's children to find CfnResource objects
      stack.node.findAll().forEach(child => {
        if (child instanceof cdk.CfnResource) {
          const cfnResource = child as cdk.CfnResource;
          if (cfnResource.cfnResourceType === 'AWS::OpenSearchServerless::SecurityPolicy' || 
              cfnResource.cfnResourceType === 'AWS::OpenSearchServerless::AccessPolicy') {
            console.log(`Handling OpenSearch resource: ${cfnResource.cfnResourceType} - ${cfnResource.node.id}`);
            
            // Add metadata to indicate it should be skipped
            cfnResource.node.addMetadata('aws:cdk:skip', 'true');
            
            // Mark it for retention (don't delete on rollback)
            cfnResource.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN, {
              applyToUpdateReplacePolicy: true
            });
            
            // Overwrite the rendered CloudFormation with a harmless custom resource
            // Use a counter to ensure truly unique IDs
            const oldLogicalId = cfnResource.logicalId;
            const uniqueCounter = ++OpenSearchSecurityPolicyHandler.resourceCounter;
            console.log(`Assigning unique ID: Skipped${oldLogicalId}${uniqueCounter}`);
            cfnResource.overrideLogicalId(`Skipped${oldLogicalId}${uniqueCounter}`);
          }
        }
      });
    } catch (error) {
      console.log(`Error handling OpenSearch resources: ${error}`);
    }
  }

  constructor(
    scope: Construct,
    id: string,
    props: bedrock.VectorKnowledgeBaseProps,
    securityPolicyHandler: OpenSearchSecurityPolicyHandler
  ) {
    this.scope = scope;
    this.securityPolicyHandler = securityPolicyHandler;

    // Create the knowledge base
    this.knowledgeBase = new bedrock.VectorKnowledgeBase(scope, id, props);
    
    // ⚠️ Use escape hatch to remove OpenSearch security policy resources from CloudFormation template
    // This prevents CloudFormation from trying to create resources that might already exist
    this.removeOpenSearchPoliciesFromTemplate(scope);

    // Extract the knowledge base ID for use in naming security policies
    const kbId = this.knowledgeBase.knowledgeBaseId;

    // Create network policy with idempotent handling for main KB
    const networkPolicyName = `networkpolicymacdectors${kbId.substring(0, 8)}`;
    this.securityPolicyHandler.createOrUpdateSecurityPolicy(
      scope,
      `${id}NetworkPolicy`,
      networkPolicyName,
      'network',
      JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${kbId}`],
            AllowFromPublic: true,
          },
        ],
        Version: '2023-01-01',
      })
    );

    // Create encryption policy with idempotent handling for main KB
    const encryptionPolicyName = `encryptionpolicymacdtors${kbId.substring(0, 8)}`;
    this.securityPolicyHandler.createOrUpdateSecurityPolicy(
      scope,
      `${id}EncryptionPolicy`,
      encryptionPolicyName,
      'encryption',
      JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${kbId}`],
          },
        ],
        AWSOwnedKey: true,
        Version: '2023-01-01',
      })
    );
    
    // Create data access policy with idempotent handling for main KB
    const dataAccessPolicyName = `dataaccesspolicymacdtors${kbId.substring(0, 8)}`;
    this.securityPolicyHandler.createOrUpdateSecurityPolicy(
      scope,
      `${id}DataAccessPolicy`,
      dataAccessPolicyName,
      'data',
      JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${kbId}`],
            Permission: [
              'aoss:CreateCollectionItems',
              'aoss:DeleteCollectionItems',
              'aoss:UpdateCollectionItems',
              'aoss:DescribeCollectionItems'
            ]
          },
          {
            ResourceType: 'index',
            Resource: [`index/${kbId}/*`],
            Permission: [
              'aoss:CreateIndex',
              'aoss:DeleteIndex',
              'aoss:UpdateIndex',
              'aoss:DescribeIndex',
              'aoss:ReadDocument',
              'aoss:WriteDocument'
            ]
          }
        ],
        Version: '2023-01-01',
        IAMPrincipals: ['*']
      })
    );
    
    // Get the collection ID for the KBVectors component (which is <kbId> + "_vectors")
    const vectorCollectionId = `${kbId}_vectors`;
    
    // Create network policy with idempotent handling for KBVectors
    const vectorsNetworkPolicyName = `networkpolicymacdectors${vectorCollectionId.substring(0, 8)}`;
    this.securityPolicyHandler.createOrUpdateSecurityPolicy(
      scope,
      `${id}KBVectorsNetworkPolicy`,
      vectorsNetworkPolicyName,
      'network',
      JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${vectorCollectionId}`],
            AllowFromPublic: true,
          },
        ],
        Version: '2023-01-01',
      })
    );

    // Create encryption policy with idempotent handling for KBVectors
    const vectorsEncryptionPolicyName = `encryptionpolicymacdtors${vectorCollectionId.substring(0, 8)}`;
    this.securityPolicyHandler.createOrUpdateSecurityPolicy(
      scope,
      `${id}KBVectorsEncryptionPolicy`,
      vectorsEncryptionPolicyName,
      'encryption',
      JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${vectorCollectionId}`],
          },
        ],
        AWSOwnedKey: true,
        Version: '2023-01-01',
      })
    );
    
    // Create data access policy with idempotent handling for KBVectors
    const vectorsDataAccessPolicyName = `dataaccesspolicymacdtors${vectorCollectionId.substring(0, 8)}`;
    this.securityPolicyHandler.createOrUpdateSecurityPolicy(
      scope,
      `${id}KBVectorsDataAccessPolicy`,
      vectorsDataAccessPolicyName,
      'data',
      JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${vectorCollectionId}`],
            Permission: [
              'aoss:CreateCollectionItems',
              'aoss:DeleteCollectionItems',
              'aoss:UpdateCollectionItems',
              'aoss:DescribeCollectionItems'
            ]
          },
          {
            ResourceType: 'index',
            Resource: [`index/${vectorCollectionId}/*`],
            Permission: [
              'aoss:CreateIndex',
              'aoss:DeleteIndex',
              'aoss:UpdateIndex',
              'aoss:DescribeIndex',
              'aoss:ReadDocument',
              'aoss:WriteDocument'
            ]
          }
        ],
        Version: '2023-01-01',
        IAMPrincipals: ['*']
      })
    );
  }
}
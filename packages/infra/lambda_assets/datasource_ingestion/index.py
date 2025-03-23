import os
import boto3
import json
import time
import logging
import cfnresponse

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize Bedrock agent client
bedrock_agent = boto3.client('bedrock-agent')

def lambda_handler(event, context):
    """
    Lambda handler for starting data source ingestion jobs with retry logic
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Extract properties from the event
    request_type = event['RequestType']
    resource_properties = event.get('ResourceProperties', {})
    
    physical_resource_id = event.get('PhysicalResourceId', 
                                    resource_properties.get('PhysicalResourceId', 'DataSourceIngestion'))
    
    try:
        if request_type in ['Create', 'Update']:
            # Extract data source and knowledge base IDs
            data_source_id = resource_properties.get('dataSourceId')
            knowledge_base_id = resource_properties.get('knowledgeBaseId')
            
            if not data_source_id or not knowledge_base_id:
                raise ValueError("Missing required parameters: dataSourceId or knowledgeBaseId")
            
            # Attempt to start the ingestion job with retries
            job_id = start_ingestion_with_retries(data_source_id, knowledge_base_id)
            
            # Return success
            return cfnresponse.send(
                event, 
                context, 
                cfnresponse.SUCCESS, 
                {
                    'Message': f'Successfully started ingestion job: {job_id}',
                    'JobId': job_id
                },
                physical_resource_id
            )
            
        elif request_type == 'Delete':
            # Nothing to do for Delete - we don't want to stop ingestion jobs
            logger.info("Delete event received, nothing to do")
            return cfnresponse.send(
                event, 
                context, 
                cfnresponse.SUCCESS, 
                {'Message': 'Delete successful - no action required'},
                physical_resource_id
            )
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        return cfnresponse.send(
            event, 
            context, 
            cfnresponse.FAILED, 
            {'Message': str(e)},
            physical_resource_id
        )

def start_ingestion_with_retries(data_source_id, knowledge_base_id, max_retries=8):
    """
    Start an ingestion job with exponential backoff retry logic
    """
    retry_count = 0
    last_exception = None
    
    # Check if there's already an ingestion job running
    try:
        existing_jobs = list_ingestion_jobs(data_source_id, knowledge_base_id)
        running_jobs = [job for job in existing_jobs if job['status'] in ['STARTING', 'IN_PROGRESS']]
        
        if running_jobs:
            logger.info(f"Found {len(running_jobs)} already running ingestion jobs. Using existing job.")
            return running_jobs[0]['ingestionJobId']
    except Exception as e:
        logger.warning(f"Error checking existing ingestion jobs: {str(e)}")
    
    # Retry loop with exponential backoff
    while retry_count < max_retries:
        try:
            # Wait with exponential backoff before retrying
            if retry_count > 0:
                wait_time = (2 ** retry_count) + (retry_count * 0.1)
                logger.info(f"Retry {retry_count}/{max_retries}, waiting {wait_time:.2f} seconds...")
                time.sleep(wait_time)
            
            # Call the startIngestionJob API
            response = bedrock_agent.start_ingestion_job(
                dataSourceId=data_source_id,
                knowledgeBaseId=knowledge_base_id
            )
            
            job_id = response.get('ingestionJob', {}).get('ingestionJobId')
            logger.info(f"Successfully started ingestion job: {job_id}")
            return job_id
            
        except bedrock_agent.exceptions.ThrottlingException as e:
            logger.warning(f"Request throttled (retry {retry_count+1}/{max_retries}): {str(e)}")
            last_exception = e
            retry_count += 1
            
        except bedrock_agent.exceptions.ConflictException as e:
            # Handle case where an ingestion job is already running
            logger.warning(f"Conflict - may be an existing job: {str(e)}")
            
            # Try to get the running job ID
            try:
                existing_jobs = list_ingestion_jobs(data_source_id, knowledge_base_id)
                running_jobs = [job for job in existing_jobs if job['status'] in ['STARTING', 'IN_PROGRESS']]
                
                if running_jobs:
                    logger.info(f"Found running ingestion job: {running_jobs[0]['ingestionJobId']}")
                    return running_jobs[0]['ingestionJobId']
            except Exception:
                pass
                
            # If we can't find the job ID, treat this as a success anyway
            logger.info("Conflict indicates job likely already running")
            return "existing-job"
            
        except Exception as e:
            logger.error(f"Error starting ingestion job: {str(e)}", exc_info=True)
            last_exception = e
            retry_count += 1
    
    # If we've exhausted all retries, raise the last exception
    raise last_exception or Exception("Maximum retries exceeded")

def list_ingestion_jobs(data_source_id, knowledge_base_id, max_results=10):
    """List ingestion jobs for the specified data source"""
    response = bedrock_agent.list_ingestion_jobs(
        dataSourceId=data_source_id,
        knowledgeBaseId=knowledge_base_id,
        maxResults=max_results
    )
    return response.get('ingestionJobs', [])
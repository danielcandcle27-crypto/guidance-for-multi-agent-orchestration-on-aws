import boto3
import json
import logging
import os
import time
import botocore
from datetime import datetime, timedelta

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize Boto3 client with retry configuration
session = boto3.Session()
config = botocore.config.Config(
    retries=dict(
        max_attempts=5,  # Retry up to 5 times
        mode='adaptive'  # Use exponential backoff strategy
    )
)
bedrock_agent = session.client('bedrock-agent', config=config)

def lambda_handler(event, context):
    """
    Lambda function to check the status of knowledge bases and their ingestion jobs.
    If no recent successful ingestion job is found, a new one is started.
    
    Event example:
    {
        "knowledgeBaseIds": [
            "knowledge-base-id-1",
            "knowledge-base-id-2"
        ]
    }
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    knowledge_base_ids = []
    
    # Check if knowledgeBaseIds were provided in the event
    if 'knowledgeBaseIds' in event:
        knowledge_base_ids = event['knowledgeBaseIds']
    
    # If no KBs provided, list all knowledge bases
    if not knowledge_base_ids:
        try:
            response = bedrock_agent.list_knowledge_bases()
            knowledge_base_ids = [kb['knowledgeBaseId'] for kb in response.get('knowledgeBaseSummaries', [])]
            logger.info(f"Found {len(knowledge_base_ids)} knowledge bases")
        except Exception as e:
            logger.error(f"Error listing knowledge bases: {str(e)}")
            return {
                'statusCode': 500,
                'body': f"Error listing knowledge bases: {str(e)}"
            }
    
    results = {}
    
    # Check each knowledge base
    for kb_id in knowledge_base_ids:
        try:
            # Get the knowledge base details with retry for eventual consistency
            kb_details = None
            max_retries = 5
            retry_count = 0
            
            while retry_count < max_retries:
                try:
                    kb_details = bedrock_agent.get_knowledge_base(knowledgeBaseId=kb_id)
                    break
                except bedrock_agent.exceptions.ResourceNotFoundException:
                    retry_count += 1
                    if retry_count >= max_retries:
                        raise
                    logger.info(f"Knowledge base {kb_id} not found yet, retrying in 5 seconds (attempt {retry_count}/{max_retries})")
                    time.sleep(5)
            
            kb_name = kb_details.get('name', 'Unknown')
            
            # List data sources for this knowledge base with retry for eventual consistency
            data_sources = None
            retry_count = 0
            
            while retry_count < max_retries:
                try:
                    data_sources = bedrock_agent.list_data_sources(knowledgeBaseId=kb_id)
                    break
                except bedrock_agent.exceptions.ResourceNotFoundException:
                    retry_count += 1
                    if retry_count >= max_retries:
                        raise
                    logger.info(f"Data sources for knowledge base {kb_id} not found yet, retrying in 5 seconds (attempt {retry_count}/{max_retries})")
                    time.sleep(5)
            
            data_source_ids = [ds['dataSourceId'] for ds in data_sources.get('dataSourceSummaries', [])]
            
            logger.info(f"Knowledge Base: {kb_name} ({kb_id}) has {len(data_source_ids)} data sources")
            
            # If no data sources found, log a warning
            if not data_source_ids:
                logger.warning(f"No data sources found for knowledge base {kb_name} ({kb_id}). Knowledge base may not be completely set up yet.")
            
            kb_results = []
            
            # For each data source, check ingestion jobs
            for ds_id in data_source_ids:
                ds_details = bedrock_agent.get_data_source(
                    knowledgeBaseId=kb_id,
                    dataSourceId=ds_id
                )
                ds_name = ds_details.get('name', 'Unknown')
                
                # List ingestion jobs for this data source
                ingestion_jobs = bedrock_agent.list_ingestion_jobs(
                    knowledgeBaseId=kb_id,
                    dataSourceId=ds_id
                )
                
                # Check for recent successful jobs (within last 24 hours)
                recent_success = False
                one_day_ago = datetime.now() - timedelta(days=1)
                
                for job in ingestion_jobs.get('ingestionJobSummaries', []):
                    if job.get('status') == 'COMPLETE' and job.get('completedAt', datetime.min) > one_day_ago:
                        recent_success = True
                        break
                
                # If no recent successful job, start a new one with retries
                if not recent_success:
                    logger.info(f"No recent successful ingestion job for data source {ds_name} ({ds_id}). Starting new job.")
                    
                    retry_count = 0
                    max_retries = 3
                    backoff_time = 2  # Start with 2 seconds
                    success = False
                    
                    while retry_count < max_retries and not success:
                        try:
                            new_job = bedrock_agent.start_ingestion_job(
                                knowledgeBaseId=kb_id,
                                dataSourceId=ds_id
                            )
                            job_id = new_job.get('ingestionJobId')
                            logger.info(f"Started new ingestion job {job_id}")
                            kb_results.append({
                                'dataSourceId': ds_id,
                                'dataSourceName': ds_name,
                                'action': 'STARTED_INGESTION',
                                'jobId': job_id
                            })
                            success = True
                        except botocore.exceptions.ClientError as e:
                            error_code = e.response.get('Error', {}).get('Code', '')
                            
                            # Handle rate limiting or resource contention with retries
                            if error_code in ['ThrottlingException', 'TooManyRequestsException', 'LimitExceededException']:
                                retry_count += 1
                                if retry_count < max_retries:
                                    logger.warning(f"Rate limited when starting ingestion job. Retrying in {backoff_time}s (attempt {retry_count}/{max_retries})")
                                    time.sleep(backoff_time)
                                    backoff_time *= 2  # Exponential backoff
                                else:
                                    logger.error(f"Failed to start ingestion job after {max_retries} attempts: {str(e)}")
                                    kb_results.append({
                                        'dataSourceId': ds_id,
                                        'dataSourceName': ds_name,
                                        'action': 'ERROR',
                                        'error': f"Rate limited: {str(e)}"
                                    })
                            else:
                                logger.error(f"Error starting ingestion job: {str(e)}")
                                kb_results.append({
                                    'dataSourceId': ds_id,
                                    'dataSourceName': ds_name,
                                    'action': 'ERROR',
                                    'error': str(e)
                                })
                                break  # Exit retry loop for non-retryable errors
                        except Exception as e:
                            logger.error(f"Error starting ingestion job: {str(e)}")
                            kb_results.append({
                                'dataSourceId': ds_id,
                                'dataSourceName': ds_name,
                                'action': 'ERROR',
                                'error': str(e)
                            })
                            break  # Exit retry loop for other exceptions
                else:
                    logger.info(f"Recent successful ingestion job found for data source {ds_name} ({ds_id})")
                    kb_results.append({
                        'dataSourceId': ds_id,
                        'dataSourceName': ds_name,
                        'action': 'NONE',
                        'reason': 'RECENT_SUCCESS'
                    })
            
            results[kb_id] = {
                'knowledgeBaseName': kb_name,
                'dataSources': kb_results
            }
            
        except Exception as e:
            logger.error(f"Error processing knowledge base {kb_id}: {str(e)}", exc_info=True)
            results[kb_id] = {
                'error': str(e),
                'knowledgeBaseId': kb_id,
                'status': 'ERROR'
            }
    
    return {
        'statusCode': 200,
        'body': results
    }

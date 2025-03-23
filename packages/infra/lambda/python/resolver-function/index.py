import json
from datetime import datetime
import uuid
import boto3
import base64
import os
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import event_source, APIGatewayProxyEventV2
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext


# module imports
from ddb_utils import list_items, put_item, update_item
from prompt_builder import claude_content_template, guardrails, context_instructions, default_system_prompt, image_search_default_prompt

# initializers
tracer = Tracer()
logger = Logger()
s3_client = boto3.client('s3')
bedrock_agent_client = boto3.client(service_name="bedrock-agent-runtime")

# environment variables
data_bucket_name = os.environ['DATA_BUCKET_NAME']

def generate_response(status_code: int, body: dict) -> dict:
    return {"statusCode": status_code,  'headers': {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
    }, "body": json.dumps(body)}

@tracer.capture_method
def generate_description(body_json: dict) -> dict:
    # Your existing code here
    pass

@tracer.capture_method
def extract_attributes_org(image_key: str, directory: str) -> dict:
    # Your existing code here
    pass

@tracer.capture_method
def extract_attributes(image_key: str, directory: str) -> dict:
    # Your existing code here
    pass

@tracer.capture_method
def get_ids_handler() -> dict:
    try:
        return generate_response(200, {"message": "success", "ids": list_items()})
    except Exception as e:
        logger.error(f"Error in get_ids_handler: {str(e)}")
        return generate_response(500, {"message": f"Error: {str(e)}"})

@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
@tracer.capture_lambda_handler
@event_source(data_class=APIGatewayProxyEventV2)
def lambda_handler(event: APIGatewayProxyEventV2, context: LambdaContext) -> dict:
    try:
        route_key = event.route_key
        
        if route_key == "GET /ids":
            return get_ids_handler()
        
        return generate_response(404, {"message": "Not found"})
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return generate_response(500, {"message": f"Error: {str(e)}"})
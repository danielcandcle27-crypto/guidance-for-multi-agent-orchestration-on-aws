ws_disconnect_function_code = r"""
import json
import logging
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('WebSocketConnections')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    try:
        table.delete_item(Key={'ConnectionId': connection_id})
        logger.info(f"Connection ID {connection_id} removed from DynamoDB.")
        return {'statusCode': 200}
    except ClientError as e:
        logger.error(f"Error removing connection ID {connection_id}: {e}")
        return {'statusCode': 500, 'body': json.dumps('Failed to disconnect.')}
"""

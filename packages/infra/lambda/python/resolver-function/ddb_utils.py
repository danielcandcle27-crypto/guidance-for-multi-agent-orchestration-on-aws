import boto3
import os
from boto3.dynamodb.conditions import Key
from aws_lambda_powertools import Logger

logger = Logger()
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def list_items():
    try:
        response = table.scan()
        return response.get('Items', [])
    except Exception as e:
        logger.error(f"Error listing items: {str(e)}")
        return []

def put_item(item):
    try:
        table.put_item(Item=item)
        return True
    except Exception as e:
        logger.error(f"Error putting item: {str(e)}")
        return False

def update_item(key, update_expression, expression_values):
    try:
        table.update_item(
            Key=key,
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        return True
    except Exception as e:
        logger.error(f"Error updating item: {str(e)}")
        return False
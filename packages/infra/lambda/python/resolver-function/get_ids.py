import json
from ddb_utils import list_items
from aws_lambda_powertools import Logger

logger = Logger()

def get_ids_handler():
    try:
        items = list_items()
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Success', 'items': items})
        }
    except Exception as e:
        logger.error(f"Error in get_ids_handler: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'message': f'Error: {str(e)}'})
        }
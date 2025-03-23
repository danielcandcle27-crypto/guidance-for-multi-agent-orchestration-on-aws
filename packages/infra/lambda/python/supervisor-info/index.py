import json
import boto3
import os

def lambda_handler(event, context):
    # Implementation for supervisor info endpoint
    try:
        # Get agent_id from query parameters
        if 'queryStringParameters' in event and event['queryStringParameters'] is not None:
            agent_id = event['queryStringParameters'].get('agent_id')
        else:
            agent_id = None
            
        ssm = boto3.client('ssm')
        
        if agent_id:
            # Get specific agent supervisor info
            param_name = f"/agent/{agent_id}/supervisor"
            try:
                response = ssm.get_parameter(Name=param_name)
                supervisor_info = json.loads(response['Parameter']['Value'])
            except ssm.exceptions.ParameterNotFound:
                supervisor_info = {"status": "not_found"}
        else:
            # List all agents with supervisor info
            params = ssm.get_parameters_by_path(
                Path="/agent",
                Recursive=True
            )
            supervisor_info = []
            for param in params['Parameters']:
                if param['Name'].endswith('/supervisor'):
                    agent_id = param['Name'].split('/')[-2]
                    info = json.loads(param['Value'])
                    info['agent_id'] = agent_id
                    supervisor_info.append(info)
        response = {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Supervisor info retrieved successfully'
            })
        }
        return response
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e)
            })
        }
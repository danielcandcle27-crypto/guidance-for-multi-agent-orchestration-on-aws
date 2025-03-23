# Example list_agents
import json
import boto3
ssm_client = boto3.client('ssm')

def lambda_handler(event, context):
    try:
        agent_types = ['supervisor','order_management','personalization','troubleshoot','product_recommendation']
        model_types = ['nova-pro','nova-lite','nova-micro','haiku-3_5_v1','sonnet-3_5_v1']
        agent_ids = {}

        for agent_type in agent_types:
            agent_ids[agent_type] = {}
            for model in model_types:
                if agent_type == 'supervisor' and model in ['nova-lite','nova-micro']:
                    continue
                param_name = f'/{agent_type}/{model}/agent-alias_id'
                try:
                    response = ssm_client.get_parameter(Name=param_name)
                    agent_ids[agent_type][model] = response['Parameter']['Value']
                except ssm_client.exceptions.ParameterNotFound:
                    continue
        
        return {
            'statusCode': 200,
            'body': json.dumps(agent_ids)
        }
    except Exception as e:
        return {
            'statusCode': 403,
            'body': json.dumps({'message': 'Unauthorized', 'error':str(e)})
        }
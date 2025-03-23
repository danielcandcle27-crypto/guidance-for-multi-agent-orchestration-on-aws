# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import urllib.request
import logging

# These are used as the response status codes
SUCCESS = "SUCCESS"
FAILED = "FAILED"

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def send(event, context, response_status, response_data, physical_resource_id=None, no_echo=False):
    """
    Helper function to send a response to CloudFormation
    """
    response_url = event['ResponseURL']

    logger.info(f"CFN response URL: {response_url}")

    response_body = {
        'Status': response_status,
        'Reason': f"See the details in CloudWatch Log Stream: {context.log_stream_name}",
        'PhysicalResourceId': physical_resource_id or context.log_stream_name,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'NoEcho': no_echo,
        'Data': response_data
    }

    json_response_body = json.dumps(response_body)
    
    logger.info(f"Response body: {json_response_body}")

    headers = {
        'content-type': '',
        'content-length': str(len(json_response_body))
    }

    try:
        req = urllib.request.Request(response_url,
                                     data=json_response_body.encode('utf-8'),
                                     headers=headers,
                                     method='PUT')
        response = urllib.request.urlopen(req)
        logger.info(f"Status code: {response.getcode()}")
        return True
    except Exception as e:
        logger.error(f"Failed to send CFN response: {str(e)}")
        return False
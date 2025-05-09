import json
import boto3
import os
import cfnresponse

def handler(event, context):
    """
    Custom resource handler for restricting VPC default security group.
    This Lambda function removes all ingress and egress rules from the default
    security group of a VPC.
    """
    print('Received event:', json.dumps(event, indent=2))
    
    # Extract parameters
    request_type = event['RequestType']
    
    try:
        if request_type == 'Create' or request_type == 'Update':
            props = event['ResourceProperties']
            vpc_id = props.get('VpcId')
            
            if not vpc_id:
                raise ValueError("VpcId is required")
                
            # Get the default security group for the VPC
            ec2 = boto3.client('ec2')
            response = ec2.describe_security_groups(
                Filters=[
                    {
                        'Name': 'vpc-id',
                        'Values': [vpc_id]
                    },
                    {
                        'Name': 'group-name',
                        'Values': ['default']
                    }
                ]
            )
            
            # If default security group exists, remove all rules
            if response['SecurityGroups']:
                sg_id = response['SecurityGroups'][0]['GroupId']
                
                # Remove all ingress rules
                ec2.revoke_security_group_ingress(
                    GroupId=sg_id,
                    IpPermissions=response['SecurityGroups'][0].get('IpPermissions', [])
                )
                
                # Remove all egress rules
                ec2.revoke_security_group_egress(
                    GroupId=sg_id,
                    IpPermissions=response['SecurityGroups'][0].get('IpPermissionsEgress', [])
                )
                
                print(f"All rules removed from default security group {sg_id} in VPC {vpc_id}")
                
            # Send success response
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {
                'Message': f"Default security group for VPC {vpc_id} has been restricted"
            })
            
        elif request_type == 'Delete':
            # Nothing to do on delete
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {
                'Message': "No action required on delete"
            })
            
    except Exception as e:
        print(f"Error: {str(e)}")
        cfnresponse.send(event, context, cfnresponse.FAILED, {
            'Message': str(e)
        })
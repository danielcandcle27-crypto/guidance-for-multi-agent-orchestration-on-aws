import json
import os
import zipfile
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)
lambda_client = boto3.client('lambda')
path = '/tmp/layer'
requirement_file_path = path + '/requirement.txt'
python_dependency_folder = '/tmp/layer/python'
layer_package_file_path = path + '/function.zip'


def make_folder(path):
    os.makedirs(name=path, exist_ok=True)


def delete_folder(path):
    for f in os.listdir(path):
        if (os.path.isdir('/'.join([path, f]))):
            delete_folder('/'.join([path, f]))
            os.rmdir('/'.join([path, f]))
        else:
            os.remove('/'.join([path, f]))


def write_to_file(path, lines):
    mode = 'a'
    if (not os.path.exists(path)):
        mode = 'w'
    with open(path, mode) as filehandle:
        filehandle.writelines(lines)
        filehandle.close()


def generate_requirement_txt_file(event):
    dependencies = []
    for d in event['dependencies']:
        if (event['dependencies'][d].lower() == 'latest'):
            dependencies.append("%s\n" % d)
        else:
            dependencies.append("%s %s\n" %
                                (d, event['dependencies'][d]))
    write_to_file(requirement_file_path, dependencies)


def zipdir(path, filename):
    ziph = zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED)
    for root, dirs, files in os.walk(path):
        for file in files:
            ziph.write(os.path.join(root, file), os.path.relpath(
                os.path.join(root, file), os.path.join(path, '..')))
    ziph.close()


def install_dependencies_then_package_the_layer(requirement_file_path, dependency_target_folder, layer_package_file_path):
    cmd_exit_code = os.system(
        "pip install --target %s -r %s" % (
            dependency_target_folder, requirement_file_path))
    if (cmd_exit_code == 0):
        zipdir(dependency_target_folder, layer_package_file_path)
    else:
        raise Exception("`pip install` ran with exit code %d" % cmd_exit_code)


def create_lambda_layer(layer_package_file_path, layer):
    with open(layer_package_file_path, 'rb') as filehandle:
        response = lambda_client.publish_layer_version(
            CompatibleRuntimes=layer['compatible-runtimes'],
            Content={
                'ZipFile': filehandle.read()
            },
            Description=layer['description'],
            LayerName=layer['name'],
            LicenseInfo=layer['license-info'],
        )
        filehandle.close()
        logger.info(f"Created layer version: {response['LayerVersionArn']}")
        return response['LayerVersionArn']


def lambda_handler(event, context):
    try:
        if (os.path.exists(path)):
            delete_folder(path)
        make_folder(python_dependency_folder)
        
        # Support both custom resource and direct invocation formats
        request_type = event.get('RequestType', 'Create')
        
        if request_type == 'Delete':
            logger.info("Delete request - nothing to do")
            return {
                'PhysicalResourceId': event.get('PhysicalResourceId', 'layer-boto3'),
                'Status': 'SUCCESS'
            }
            
        # Either use the provided dependencies or default to boto3
        dependencies = event.get('dependencies', {'boto3': 'latest'})
        layer_info = event.get('layer', {
            'name': 'layer-boto3',
            'description': 'Lambda layer containing boto3',
            'compatible-runtimes': ['python3.11', 'python3.12'],
            'license-info': 'MIT'
        })
        
        # For custom resource format
        if 'ResourceProperties' in event:
            resource_props = event['ResourceProperties']
            dependencies = resource_props.get('Dependencies', {'boto3': 'latest'})
            layer_info = {
                'name': resource_props.get('LayerName', 'layer-boto3'),
                'description': resource_props.get('Description', 'Lambda layer containing boto3'),
                'compatible-runtimes': resource_props.get('CompatibleRuntimes', ['python3.11', 'python3.12']),
                'license-info': resource_props.get('LicenseInfo', 'MIT')
            }
        
        # Build event in the format the existing functions expect
        processed_event = {
            'dependencies': dependencies,
            'layer': layer_info
        }
        
        logger.info(f"Creating layer with settings: {json.dumps(processed_event)}")
        
        generate_requirement_txt_file(processed_event)
        install_dependencies_then_package_the_layer(
            requirement_file_path, python_dependency_folder, layer_package_file_path)
        layer_arn = create_lambda_layer(layer_package_file_path, processed_event['layer'])
        
        # Different response format for custom resource vs direct invocation
        if 'ResourceProperties' in event:
            return {
                'PhysicalResourceId': layer_arn,
                'Status': 'SUCCESS',
                'Data': {
                    'LayerVersionArn': layer_arn
                }
            }
        else:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Layer was created successfully',
                    'LayerVersionArn': layer_arn
                })
            }
            
    except Exception as e:
        logger.exception("Error creating layer")
        
        # Different response format for custom resource vs direct invocation
        if 'ResourceProperties' in event:
            return {
                'PhysicalResourceId': event.get('PhysicalResourceId', 'layer-boto3-failed'),
                'Status': 'FAILED',
                'Reason': str(e)
            }
        else:
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'message': f'Error creating layer: {str(e)}'
                })
            }

import json

def lambda_handler(event, context):
    print("Authorizer event:", event)

    queryStringParameters = event.get('queryStringParameters') or {}
    method_arn = event.get('methodArn', '')

    if (queryStringParameters.get('auth') == "genai-labs-mac"):
        return generateAllow("user", method_arn)
    else:
        print("Authorizer says: unauthorized")
        return generateDeny("user", method_arn)

def generatePolicy(principalId, effect, resource):
    policyDocument = {
        'Version': '2012-10-17',
        'Statement': []
    }
    statementOne = {}
    statementOne['Action'] = 'execute-api:Invoke'
    statementOne['Effect'] = effect
    statementOne['Resource'] = resource
    policyDocument['Statement'].append(statementOne)

    authResponse = {}
    authResponse['principalId'] = principalId
    authResponse['policyDocument'] = policyDocument
    authResponse['context'] = {
        "stringKey": "value",
        "numberKey": 123,
        "booleanKey": True
    }
    return authResponse

def generateAllow(principalId, resource):
    return generatePolicy(principalId, 'Allow', resource)

def generateDeny(principalId, resource):
    return generatePolicy(principalId, 'Deny', resource)

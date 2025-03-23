import json
import boto3
import random
import string
import time
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

session = boto3.session.Session()
region = session.region_name
sts_client = boto3.client("sts")
account_id = sts_client.get_caller_identity()["Account"]

bedrock_agent_client = boto3.client("bedrock-agent", region_name=region)
iam_client = boto3.client("iam")
ssm_client = boto3.client("ssm")


# --------------------------------------------------------------------
# Create or update a SINGLE DRAFT Supervisor
# --------------------------------------------------------------------
def create_supervisor_in_draft(
    agent_name,
    agent_instruction,
    foundation_model,
    agent_description,
    idle_session_ttl=1800,
    agent_collaboration="SUPERVISOR_ROUTER"
):

    agent_role_arn = ensure_agent_iam_role(agent_name)

    try:
        resp = bedrock_agent_client.create_agent(
            agentName=agent_name,
            agentResourceRoleArn=agent_role_arn,
            foundationModel=foundation_model,
            instruction=agent_instruction,
            description=agent_description,
            idleSessionTTLInSeconds=idle_session_ttl,
            agentCollaboration=agent_collaboration
        )
        agent_id = resp["agent"]["agentId"]
        wait_until_stable(agent_id)
        return agent_id
    except bedrock_agent_client.exceptions.ConflictException:
        # Already exists => do update
        agent_id = find_agent_id(agent_name)
        wait_until_stable(agent_id)
        bedrock_agent_client.update_agent(
            agentId=agent_id,
            agentName=agent_name,
            agentResourceRoleArn=agent_role_arn,
            foundationModel=foundation_model,
            instruction=agent_instruction,
            description=agent_description,
            idleSessionTTLInSeconds=idle_session_ttl,
            agentCollaboration=agent_collaboration
        )
        wait_until_stable(agent_id)
        return agent_id

def ensure_agent_iam_role(agent_name):
    role_name = f"BedrockRoleForAgents_{agent_name}"
    assume_role_doc = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "bedrock.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }
        ]
    }
    assume_doc_str = json.dumps(assume_role_doc)

    try:
        role_resp = iam_client.get_role(RoleName=role_name)
        role_arn = role_resp["Role"]["Arn"]
        logger.info(f"Reusing existing role => {role_name} => {role_arn}")
    except iam_client.exceptions.NoSuchEntityException:
        logger.info(f"Creating new IAM role => {role_name}")
        create_resp = iam_client.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=assume_doc_str
        )
        time.sleep(5)# nosemgrep: arbitrary-sleep 
        role_arn = create_resp["Role"]["Arn"]
        logger.info(f"Created role => {role_arn}")

    # Minimal bedrock agent policy
    policy_name = f"{agent_name}-BedrockAgentPolicy"
    policy_doc = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "bedrock:InvokeModel",
                    "bedrock:UpdateAgent",
                    "bedrock:PrepareAgent",
                    "bedrock:AssociateAgentCollaborator",
                    "bedrock:DisassociateAgentCollaborator",
                    "bedrock:ListAgentCollaborators",
                    "bedrock:GetAgentAlias",
                    "bedrock:InvokeAgent"
                ],
                "Resource": "*"
            }
        ]
    }

    policy_doc_str = json.dumps(policy_doc)
    policy_arn = f"arn:aws:iam::{account_id}:policy/{policy_name}"

    try:
        iam_client.create_policy(
            PolicyName=policy_name,
            PolicyDocument=policy_doc_str
        )
        logger.info(f"Created policy => {policy_name}")
        time.sleep(3)# nosemgrep: arbitrary-sleep 
    except iam_client.exceptions.EntityAlreadyExistsException:
        logger.info(f"Policy {policy_name} already exists, reusing")

    attach_policy_if_needed(role_name, policy_arn)

    # cross-region inference policy
    cross_region_policy_doc = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "BedrockAgentInferenceProfilesCrossRegionPolicyProd",
                "Effect": "Allow",
                "Action": [
                    "bedrock:InvokeModel",
                    "bedrock:GetInferenceProfile",
                    "bedrock:GetFoundationModel",
                    "bedrock:InvokeModelWithResponseStream"
                ],
                "Resource": [
                    f"arn:aws:bedrock:us-west-2:{account_id}:inference-profile/us.amazon.nova-pro-v1:0",
                    "arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0",
                    f"arn:aws:bedrock:us-west-2:{account_id}::inference-profile/us.amazon.nova-lite-v1:0",
                    "arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0",
                    f"arn:aws:bedrock:us-west-2:{account_id}:inference-profile/us.amazon.nova-micro-v1:0",
                    "arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0"
                ]
            }
        ]
    }
    cross_region_policy_name = f"{agent_name}-CrossRegionInferencePolicy"
    cross_region_policy_doc_str = json.dumps(cross_region_policy_doc)
    cross_region_policy_arn = f"arn:aws:iam::{account_id}:policy/{cross_region_policy_name}"

    try:
        iam_client.create_policy(
            PolicyName=cross_region_policy_name,
            PolicyDocument=cross_region_policy_doc_str
        )
        logger.info(f"Created cross-region policy => {cross_region_policy_name}")
        time.sleep(3)# nosemgrep: arbitrary-sleep 
    except iam_client.exceptions.EntityAlreadyExistsException:
        logger.info(f"Cross-region policy {cross_region_policy_name} already exists, reusing")

    attach_policy_if_needed(role_name, cross_region_policy_arn)

    return role_arn

def attach_policy_if_needed(role_name, policy_arn):
    attached_policies = iam_client.list_attached_role_policies(RoleName=role_name)["AttachedPolicies"]
    attached_arns = [p["PolicyArn"] for p in attached_policies]
    if policy_arn not in attached_arns:
        iam_client.attach_role_policy(RoleName=role_name, PolicyArn=policy_arn)
        logger.info(f"Attached policy => {policy_arn} to role => {role_name}")
    else:
        logger.info(f"Policy {policy_arn} already attached => {role_name}")

def associate_subagents_and_prepare(supervisor_agent_id, sub_agents):

    for sub in sub_agents:
        wait_until_stable(supervisor_agent_id)
        try:
            bedrock_agent_client.associate_agent_collaborator(
                agentId=supervisor_agent_id,
                agentVersion="DRAFT",
                agentDescriptor={"aliasArn": sub["arn"]},
                collaboratorName=sub["name"],
                collaborationInstruction=f"Use sub-agent {sub['name']}",
                relayConversationHistory="TO_COLLABORATOR"
            )
            logger.info(f"Associated sub-agent {sub['name']} => {supervisor_agent_id}")
        except bedrock_agent_client.exceptions.ConflictException:
            logger.warning(f"Sub-agent {sub['name']} is already associated. Skipping.")

        wait_until_stable(supervisor_agent_id)
        bedrock_agent_client.prepare_agent(agentId=supervisor_agent_id)
        wait_until_stable(supervisor_agent_id)

def find_agent_id(agent_name):
    resp = bedrock_agent_client.list_agents(maxResults=1000)
    for summary in resp["agentSummaries"]:
        if summary["agentName"] == agent_name:
            return summary["agentId"]
    raise RuntimeError(f"No agent found for name={agent_name}")

def wait_until_stable(agent_id):
    while True:
        info = bedrock_agent_client.get_agent(agentId=agent_id)
        status = info["agent"]["agentStatus"]
        if status.endswith("ING") or status == "VERSIONING":
            print(f"Agent {agent_id} => status={status}, wait 5s.")
            time.sleep(5)# nosemgrep: arbitrary-sleep 
        elif status == "DELETED":
            print(f"Agent {agent_id} => DELETED. Exiting wait.")
            break
        else:
            print(f"Agent {agent_id} => stable status={status}")
            break

# --------------------------------------------------------------------
# Lambda handler - ensures all responses have the same CORS headers
# --------------------------------------------------------------------
def lambda_handler(event, context):
    try:
        method = event.get("httpMethod", "")
        resource = event.get("resource", "")
        route_key = f"{method} {resource}"
        logger.info(f"Derived route_key={route_key}")
        logger.info(f"Full event => {json.dumps(event, indent=2)}")

        # ================= GET /supervisor-info =================
        if route_key == "GET /supervisor-info":
            result = get_supervisor_info(event, context)
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps(result)
            }

        # ================= POST /temp-agent =================
        elif route_key == "POST /temp-agent":
            body = json.loads(event.get("body", "{}"))
            # If user doesn't provide agent_name => random
            agent_name = body.get("agent_name")
            if not agent_name:
                agent_name = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))

            supervisor_info = body.get("supervisor_info", "") or body.get("supervisorInfo", "")
            sub_agents_info = body.get("sub_agents_info") or body.get("subAgentsInfo", {})

            if not sub_agents_info or not isinstance(sub_agents_info, dict):
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    "body": json.dumps({"error": "Missing or invalid 'sub_agents_info'."})
                }

            try:
                result = create_temp_supervisor_agent(agent_name, supervisor_info, sub_agents_info)
                return {
                    "statusCode": 200,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    "body": json.dumps(result)
                }
            except Exception as e:
                logger.exception("Exception in create_temp_supervisor_agent")
                return {
                    "statusCode": 500,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    "body": json.dumps({"error": str(e)})
                }

        # ================ ELSE => 404 ================
        return {
            "statusCode": 404,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error":"Route not found"})
        }

    except Exception as e:
        logger.exception("Unhandled exception in lambda_handler")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": str(e)})
        }

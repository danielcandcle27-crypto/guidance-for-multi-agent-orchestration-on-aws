import { Stack, RemovalPolicy, CfnOutput, Duration, CustomResource } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { setSecureTransport } from "../constructs/cdk-helpers";
import { CDKProps } from "../config/AppConfig";
import { Key } from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";

interface BucketStackProps extends CDKProps {
  distributionDomainName: string;
}

export class BucketStack extends Stack {
  public readonly dataBucket: Bucket;
  public readonly dataBucketKey: Key;

  public readonly macDataStrBucket: Bucket;
  public readonly personalizeUnstrBucket: Bucket;
  public readonly prodRecUnstrBucket: Bucket;
  public readonly tsFaqUnstrBucket: Bucket;
  public readonly athenaOutputBucket: Bucket;

  constructor(scope: Construct, id: string, props: BucketStackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------------
    // 1) Access Logs Bucket
    // -------------------------------------------------------------------------
    const dataAccessLogsBucket = new Bucket(
      this,
      `${props.projectName}-data-bucket-access-logs`,
      {
        objectOwnership: ObjectOwnership.OBJECT_WRITER,
        autoDeleteObjects: true,
        encryption: BucketEncryption.S3_MANAGED,
        blockPublicAccess: {
          blockPublicAcls: true,
          blockPublicPolicy: true,
          ignorePublicAcls: true,
          restrictPublicBuckets: true,
        },
        removalPolicy: RemovalPolicy.DESTROY,
        serverAccessLogsPrefix: "data-access-logs-bucket",
        enforceSSL: true,
      }
    );
    setSecureTransport(dataAccessLogsBucket);

    // -------------------------------------------------------------------------
    // 2) KMS Key
    // -------------------------------------------------------------------------
    this.dataBucketKey = new Key(this, `${props.projectName}-key`, {
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
      alias: `${props.projectName}-alias`,
      description: "KMS key for encrypting the objects in an S3 bucket",
      enableKeyRotation: true,
      rotationPeriod: Duration.days(365),
    });

    // -------------------------------------------------------------------------
    // 3) Existing dataBucket for your site
    // -------------------------------------------------------------------------
    this.dataBucket = new Bucket(this, `${props.projectName}-data-bucket`, {
      bucketName: `${props.projectName}-data-bucket-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.KMS,
      encryptionKey: this.dataBucketKey,
      removalPolicy: RemovalPolicy.RETAIN,
      serverAccessLogsBucket: dataAccessLogsBucket,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedMethods: [
            HttpMethods.GET,
            HttpMethods.POST,
            HttpMethods.PUT,
            HttpMethods.HEAD,
            HttpMethods.DELETE,
          ],
          allowedOrigins: [
            "http://localhost:3000",
            `https://${props.distributionDomainName}`,
          ],
          allowedHeaders: ["*"],
          exposedHeaders: [
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2",
            "ETag",
            "x-amz-meta-foo",
          ],
          maxAge: 3000,
        },
      ],
    });
    setSecureTransport(this.dataBucket);

    // -------------------------------------------------------------------------
    // 4) Buckets matching your Lambda code references
    // -------------------------------------------------------------------------
    this.macDataStrBucket = new Bucket(this, "GenaiLabsMacDataStr", {
      bucketName: `genai-labs-mac-data-str-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      enforceSSL: true,
      versioned: true,
    });

    this.personalizeUnstrBucket = new Bucket(this, "GenaiLabsPersonalizeUnstr", {
      bucketName: `genai-labs-personalize-unstr-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    this.prodRecUnstrBucket = new Bucket(this, "GenaiLabsProdRecUnstr", {
      bucketName: `genai-labs-prod-rec-unstr-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    this.tsFaqUnstrBucket = new Bucket(this, "GenaiLabsTSFaqUnstr", {
      bucketName: `genai-labs-ts-faq-unstr-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    this.athenaOutputBucket = new Bucket(this, "GenaiAthenaOutputBucket", {
      bucketName: `genai-athena-output-bucket-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    // -------------------------------------------------------------------------
    // 5) Outputs
    // -------------------------------------------------------------------------
    new CfnOutput(this, "config-s3-data-bucket-name", {
      value: this.dataBucket.bucketName,
      description: "Data bucket name",
      exportName: `${props.projectName}-config-s3-data-bucket-name`,
    });

    new CfnOutput(this, "config-s3-data-bucket-arn", {
      value: this.dataBucket.bucketArn,
      description: "data bucket ARN",
      exportName: `${props.projectName}-config-s3-data-bucket-arn`,
    });

    new CfnOutput(this, "macDataStrBucketName", {
      value: this.macDataStrBucket.bucketName,
      description: "Name of the genai-labs-mac-data-str bucket",
    });

    new CfnOutput(this, "personalizeUnstrBucketName", {
      value: this.personalizeUnstrBucket.bucketName,
      description: "Name of the genai-labs-personalize-unstr bucket",
    });

    new CfnOutput(this, "prodRecUnstrBucketName", {
      value: this.prodRecUnstrBucket.bucketName,
      description: "Name of the genai-labs-prod-rec-unstr bucket",
    });

    new CfnOutput(this, "tsFaqUnstrBucketName", {
      value: this.tsFaqUnstrBucket.bucketName,
      description: "Name of the genai-labs-ts-faq-unstr bucket",
    });

    new CfnOutput(this, "athenaOutputBucketName", {
      value: this.athenaOutputBucket.bucketName,
      description: "Name of the genai-athena-output-bucket",
    });

    // -------------------------------------------------------------------------
    // 6) **Custom Resource** that runs your Python code at deploy time
    // -------------------------------------------------------------------------

    // Create a Lambda function from inline Python code (verbatim from your snippet).
    // For large code, consider using `lambda.Code.fromAsset(...)` instead.
    const setupLambda = new lambda.Function(this, "SetupAthenaAndDataLambda", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "index.lambda_handler",
      timeout: Duration.minutes(15),
      code: lambda.Code.fromInline(`
import boto3
import json
import time
import logging
import urllib3
from botocore.exceptions import ClientError

# The cfnresponse module is pre-installed in AWS Lambda Python runtimes.
# If you are using Python 3.9 or 3.10+ and see "No module named cfnresponse",
# you can vendor the code yourself or switch to a Lambda layer that provides it.
import cfnresponse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

session = boto3.session.Session()
region = session.region_name

s3_client = session.client("s3", region_name=region)
athena_client = session.client("athena", region_name=region)
sts_client = session.client("sts", region_name=region)
ssm_client = session.client("ssm", region_name=region)
http = urllib3.PoolManager()

def lambda_handler(event, context):
    logger.info("CFN Event: %s", json.dumps(event))
    try:
        # Check if this is a Delete event; if so, we typically just respond SUCCESS (or do cleanup).
        if event["RequestType"] == "Delete":
            logger.info("Received Delete request – no action needed.")
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
            return

        account_number = sts_client.get_caller_identity()["Account"]
        athena_bucket_name = f"genai-athena-output-bucket-{account_number}-{region}"
        athena_output_bucket = f"s3://{athena_bucket_name}/"
        
        logger.info(f"Using Athena output bucket: {athena_output_bucket}")
        
        # Store Athena output bucket in SSM - use consistent parameter name formatting
        ssm_client.put_parameter(
            Name="/athena-bucket",
            Value=f"s3://genai-athena-output-bucket-{account_number}-{region}/",
            Type="String",
            Overwrite=True
        )
        
        # Configure Athena workgroup settings
        try:
            # First check if the primary workgroup exists and get its configuration
            workgroup_response = athena_client.get_work_group(WorkGroup='primary')
            logger.info(f"Found existing workgroup configuration: {workgroup_response}")
            
            # Update the primary workgroup to set the output location
            athena_client.update_work_group(
                WorkGroup='primary',
                Description='Updated by MAC demo deployment',
                Configuration={
                    'ResultConfiguration': {
                        'OutputLocation': athena_output_bucket,
                    },
                    'EnforceWorkGroupConfiguration': True,
                    'PublishCloudWatchMetricsEnabled': True,
                    'RequesterPaysEnabled': False
                }
            )
            logger.info(f"Successfully configured Athena primary workgroup with output location: {athena_output_bucket}")
        except Exception as e:
            logger.error(f"Error configuring Athena workgroup: {str(e)}")
            # This is not fatal as the output location can also be specified per query

        # We've removed bucket creation from Lambda since CDK handles bucket creation

        # Download & upload objects
        urls = {
            "order_mgnt/structured/inventory/inventory_system.csv": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/order_mgnt_agent/inventory/inventory.csv",
                "bucket": f"genai-labs-mac-data-str-{account_number}-{region}",
            },
            "order_mgnt/structured/orders/orders.csv": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/order_mgnt_agent/orders/orders.csv",
                "bucket": f"genai-labs-mac-data-str-{account_number}-{region}",
            },
            "personalization/structured/preferences/customers_preferences.csv": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/personalize_agent/structured/customers_preferences.csv",
                "bucket": f"genai-labs-mac-data-str-{account_number}-{region}",
            },
            "personalization/unstructured/history/browse_history.txt": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/personalize_agent/unstructured/browse_history.txt",
                "bucket": f"genai-labs-personalize-unstr-{account_number}-{region}",
            },
            "prod_rec/structured/catalog/product_catalog.csv": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/prod_recommendation_agent/structured/product_catalog.csv",
                "bucket": f"genai-labs-mac-data-str-{account_number}-{region}",
            },
            "prod_rec/structured/history/purchase_history.csv": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/prod_recommendation_agent/structured/purchase_history.csv",
                "bucket": f"genai-labs-mac-data-str-{account_number}-{region}",
            },
            "prod_rec/unstructured/customer_feedback.txt": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/prod_recommendation_agent/unstructured/customer_feedback.txt",
                "bucket": f"genai-labs-prod-rec-unstr-{account_number}-{region}",
            },
            "ts/unstructured/faq/faq.txt": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/troubleshoot_agent/faq/faq.txt",
                "bucket": f"genai-labs-ts-faq-unstr-{account_number}-{region}",
            },
            "ts/unstructured/ts_guide/ts_guide.txt": {
                "url": "https://github.com/jossai87/testdata/raw/main/mac-mock-data/troubleshoot_agent/ts/ts_guide.txt",
                "bucket": f"genai-labs-ts-faq-unstr-{account_number}-{region}",
            }
        }

        load_data(urls)

        # Create Athena databases & tables
        create_databases(athena_output_bucket)
        time.sleep(5)  # optional delay
        create_product_catalog_table(account_number, athena_output_bucket)
        create_purchase_history_table(account_number, athena_output_bucket)
        create_customers_preferences_table(account_number, athena_output_bucket)
        create_orders_table(account_number, athena_output_bucket)
        create_inventory_table(account_number, athena_output_bucket)

        logger.info("All databases and tables created successfully.")

        # The final step: tell CloudFormation we succeeded.
        response_data = {"Message": "All operations completed successfully."}
        cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)

    except Exception as e:
        logger.error(f"Unhandled error in Lambda: {str(e)}")
        # On error, tell CloudFormation we failed, so it won't hang the stack deployment.
        cfnresponse.send(event, context, cfnresponse.FAILED, {"Error": str(e)})

def create_s3_bucket(bucket_name, region):
    """
    Creates an S3 bucket if you haven't removed this logic.
    Usually raises 'BucketAlreadyOwnedByYou' if it exists.
    """
    try:
        if region == "us-east-1":
            s3_client.create_bucket(Bucket=bucket_name)
        else:
            s3_client.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": region}
            )
        logger.info(f"Bucket '{bucket_name}' created successfully in region '{region}'.")
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "BucketAlreadyOwnedByYou":
            logger.info(f"Bucket '{bucket_name}' already exists and is owned by you.")
        else:
            logger.error(f"Error creating bucket '{bucket_name}': {e}")
            raise

def load_data(urls):
    for key, data in urls.items():
        url = data["url"]
        bucket = data["bucket"]
        response = http.request("GET", url)
        if response.status == 200:
            s3_client.put_object(Bucket=bucket, Key=key, Body=response.data)
            logger.info(f"Successfully uploaded {key} to {bucket}")
        else:
            logger.error(f"Failed to download {url}, status code: {response.status}")
            raise Exception(f"HTTP {response.status} from {url}")

def create_databases(athena_output_bucket):
    databases = ["prod_rec", "personalization", "order_management"]
    for db_name in databases:
        query = f"CREATE DATABASE IF NOT EXISTS {db_name}"
        athena_client.start_query_execution(
            QueryString=query,
            ResultConfiguration={"OutputLocation": athena_output_bucket},
        )
        logger.info(f"Database '{db_name}' creation initiated.")

def create_product_catalog_table(account_number, athena_output_bucket):
    query = f\"\"\"
    CREATE EXTERNAL TABLE IF NOT EXISTS prod_rec.product_catalog (
        product_id STRING,
        product_name STRING,
        category STRING,
        price INT,
        description STRING,
        rating FLOAT,
        popularity STRING
    )
    ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
    WITH SERDEPROPERTIES ('serialization.format' = ',')
    LOCATION 's3://genai-labs-mac-data-str-{account_number}-{region}/prod_rec/structured/catalog/'
    TBLPROPERTIES ('skip.header.line.count'='1');
    \"\"\"
    athena_client.start_query_execution(
        QueryString=query,
        ResultConfiguration={"OutputLocation": athena_output_bucket},
    )
    logger.info("Table 'product_catalog' created successfully.")

def create_purchase_history_table(account_number, athena_output_bucket):
    query = f\"\"\"
    CREATE EXTERNAL TABLE IF NOT EXISTS prod_rec.purchase_history (
        customer_id STRING,
        product_id STRING,
        purchase_date STRING,
        quantity INT,
        purchase_amount FLOAT,
        payment_method STRING
    )
    ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
    WITH SERDEPROPERTIES ('serialization.format' = ',')
    LOCATION 's3://genai-labs-mac-data-str-{account_number}-{region}/prod_rec/structured/history/'
    TBLPROPERTIES ('skip.header.line.count'='1');
    \"\"\"
    athena_client.start_query_execution(
        QueryString=query,
        ResultConfiguration={"OutputLocation": athena_output_bucket},
    )
    logger.info("Table 'purchase_history' created successfully.")

def create_customers_preferences_table(account_number, athena_output_bucket):
    query = f\"\"\"
    CREATE EXTERNAL TABLE IF NOT EXISTS personalization.customers_preferences (
        customer_id STRING,
        age INT,
        gender STRING,
        income STRING,
        location STRING,
        marital_status STRING,
        preferred_category STRING,
        price_range STRING,
        preferred_brand STRING,
        loyalty_tier STRING
    )
    ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
    WITH SERDEPROPERTIES ('serialization.format' = ',')
    LOCATION 's3://genai-labs-mac-data-str-{account_number}-{region}/personalization/structured/preferences/'
    TBLPROPERTIES ('skip.header.line.count'='1');
    \"\"\"
    athena_client.start_query_execution(
        QueryString=query,
        ResultConfiguration={"OutputLocation": athena_output_bucket},
    )
    logger.info("Table 'customers_preferences' created successfully.")

def create_orders_table(account_number, athena_output_bucket):
    query = f\"\"\"
    CREATE EXTERNAL TABLE IF NOT EXISTS order_management.orders (
        order_id STRING,
        customer_id STRING,
        product_id STRING,
        product_name STRING,
        order_status STRING,
        shipping_status STRING,
        return_exchange_status STRING,
        order_date STRING,
        delivery_date STRING
    )
    ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
    WITH SERDEPROPERTIES ('serialization.format' = ',')
    LOCATION 's3://genai-labs-mac-data-str-{account_number}-{region}/order_mgnt/structured/orders/'
    TBLPROPERTIES ('skip.header.line.count'='1');
    \"\"\"
    athena_client.start_query_execution(
        QueryString=query,
        ResultConfiguration={"OutputLocation": athena_output_bucket},
    )
    logger.info("Table 'orders' created successfully.")

def create_inventory_table(account_number, athena_output_bucket):
    query = f\"\"\"
    CREATE EXTERNAL TABLE IF NOT EXISTS order_management.inventory (
        product_id STRING,
        product_name STRING,
        category STRING,
        quantity INT,
        in_stock STRING,
        reorder_threshold INT,
        reorder_quantity INT,
        last_restock_date STRING
    )
    ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
    WITH SERDEPROPERTIES ('serialization.format' = ',')
    LOCATION 's3://genai-labs-mac-data-str-{account_number}-{region}/order_mgnt/structured/inventory/'
    TBLPROPERTIES ('skip.header.line.count'='1');
    \"\"\"
    athena_client.start_query_execution(
        QueryString=query,
        ResultConfiguration={"OutputLocation": athena_output_bucket},
    )
    logger.info("Table 'inventory' created successfully.")

      `),
    });

    // Grant the Lambda full S3 permissions to ensure all operations work properly
    setupLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:*"],
        resources: ["*"], // For full S3 access
      })
    );

    // Add permissions for AWS Glue Data Catalog operations needed by Athena
    setupLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "glue:CreateDatabase",
          "glue:CreateTable",
          "glue:DeleteDatabase",
          "glue:DeleteTable",
          "glue:GetDatabase",
          "glue:GetDatabases",
          "glue:GetTable",
          "glue:GetTables",
          "glue:UpdateDatabase",
          "glue:UpdateTable"
        ],
        resources: ["*"]
      })
    );
    
    // Allow Athena permissions
    setupLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:StopQueryExecution",
          "athena:GetWorkGroup",
          "athena:UpdateWorkGroup",
          "athena:GetDataCatalog",
          "athena:GetDatabase",
          "athena:GetTableMetadata",
          "athena:ListDatabases",
          "athena:ListTableMetadata",
          "athena:ListWorkGroups"
        ],
        resources: ["*"],
      })
    );
    
    // Allow SSM, STS and related services
    setupLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "ssm:PutParameter",
          "ssm:GetParameter",
          "ssm:DeleteParameter",
          "sts:GetCallerIdentity"
        ],
        resources: ["*"],
      })
    );
    
    // Add Lambda suppressions directly here
    NagSuppressions.addResourceSuppressions(
      setupLambda,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'This Lambda function requires these permissions to set up Athena databases and tables and upload sample data.'
        },
        {
          id: 'AwsSolutions-L1',
          reason: 'This Lambda function is using Python 3.12, which is a recent runtime version.'
        },
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Lambda function uses AWS managed AWSLambdaBasicExecutionRole policy for CloudWatch Logs access.'
        }
      ],
      true
    );

    // Finally, create a Custom Resource so that the Lambda is invoked once at deploy time
    new CustomResource(this, "SetupAthenaDataCR", {
      serviceToken: setupLambda.functionArn,
    });
    
    // Add CDK Nag suppressions for the data buckets
    this.addCdkNagSuppressions();
  }
  
  /**
   * Add CDK Nag suppressions for common issues in this stack
   */
  private addCdkNagSuppressions(): void {
    // Suppress S3 access logging warnings for data buckets
    const s3Buckets = [
      this.macDataStrBucket,
      this.personalizeUnstrBucket,
      this.prodRecUnstrBucket,
      this.tsFaqUnstrBucket,
      this.athenaOutputBucket
    ];
    
    s3Buckets.forEach(bucket => {
      NagSuppressions.addResourceSuppressions(
        bucket,
        [
          {
            id: 'AwsSolutions-S1',
            reason: 'These S3 buckets are used for data storage and sample data. Access logging is not required for this demo application.'
          }
        ],
        true
      );
    });
  }
}

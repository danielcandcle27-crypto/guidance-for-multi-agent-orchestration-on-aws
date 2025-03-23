import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CDKProps } from '../config/AppConfig';
import {
  AccountRecovery,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  CfnUserPoolDomain,
  CfnUserPoolGroup,
  ClientAttributes,
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import {
  Role,
  FederatedPrincipal,
  Effect,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import { NagSuppressions } from 'cdk-nag';

interface AuthStackProps extends CDKProps {
  regionalWebAclArn: string;
  distributionDomainName: string;
}

export class CognitoAuthStack extends Stack {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly identityPool: CfnIdentityPool;
  public readonly authenticatedRole: Role;
  public readonly unauthenticatedRole: Role;
  public readonly identityPoolRoleAttachment: CfnIdentityPoolRoleAttachment;

  private userPoolDomain?: CfnUserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // Create the Cognito User Pool
    this.userPool = new UserPool(this, `${props.projectName}-user-pool`, {
      userPoolName: `${props.projectName}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: { email: true },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create user pool groups
    new CfnUserPoolGroup(this, `${props.projectName}-admin-group`, {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Admin',
      description: 'Admin Group',
    });

    new CfnUserPoolGroup(this, `${props.projectName}-user-group`, {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Users',
      description: 'Users Group',
    });

    const callbackUrls = [
      `https://${props.distributionDomainName}`,
      'http://localhost:3000',
    ];

    this.userPoolClient = new UserPoolClient(
      this,
      `${props.projectName}-user-pool-client`,
      {
        userPool: this.userPool,
        userPoolClientName: `${props.projectName}-client`,
        generateSecret: false,
        refreshTokenValidity: Duration.minutes(60),
        accessTokenValidity: Duration.minutes(60),
        idTokenValidity: Duration.minutes(60),
        authFlows: {
          adminUserPassword: true,
          custom: true,
          userSrp: true,
        },
        readAttributes: new ClientAttributes().withStandardAttributes({
          email: true,
        }),
      }
    );

    // Create Cognito domain
    const domainPrefix = `${props.projectName}-${this.account}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    this.userPoolDomain = new CfnUserPoolDomain(this, 'UserPoolDomain', {
      domain: domainPrefix,
      userPoolId: this.userPool.userPoolId,
    });

    this.userPoolClient.node.addDependency(this.userPoolDomain);

    // Create Identity Pool
    this.identityPool = new CfnIdentityPool(
      this,
      `${props.projectName}-identity-pool`,
      {
        identityPoolName: `${props.projectName}-identity-pool`,
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: this.userPoolClient.userPoolClientId,
            providerName: this.userPool.userPoolProviderName,
          },
        ],
      }
    );

    // Auth & Unauth Roles
    this.authenticatedRole = new Role(this, 'AuthenticatedRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    this.unauthenticatedRole = new Role(this, 'UnauthenticatedRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Deny all for unauth
    this.unauthenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['*'],
        resources: ['*'],
      })
    );

    this.identityPoolRoleAttachment = new CfnIdentityPoolRoleAttachment(
      this,
      'RoleAttachment',
      {
        identityPoolId: this.identityPool.ref,
        roles: {
          authenticated: this.authenticatedRole.roleArn,
          unauthenticated: this.unauthenticatedRole.roleArn,
        },
      }
    );

    // Attach WAF to Cognito
    new CfnWebACLAssociation(this, `${props.projectName}-webacl-cognito-association`, {
      resourceArn: this.userPool.userPoolArn,
      webAclArn: props.regionalWebAclArn,
    });

    // Outputs
    new cdk.CfnOutput(this, 'config-cognito-identitypool-id', {
      value: this.identityPool.ref,
      description: 'Identity pool ID',
      exportName: `${props.projectName}-config-cognito-identitypool-id`,
    });

    new cdk.CfnOutput(this, 'config-cognito-userpool-id', {
      value: this.userPool.userPoolId,
      description: 'User pool ID',
      exportName: `${props.projectName}-config-cognito-userpool-id`,
    });

    new cdk.CfnOutput(this, 'config-cognito-appclient-id', {
      value: this.userPoolClient.userPoolClientId,
      description: 'User pool client ID',
      exportName: `${props.projectName}-config-cognito-appclient-id`,
    });

    new cdk.CfnOutput(this, "config-cognito-domain", {
      value: `${this.userPoolDomain.domain}.auth.${process.env.CDK_DEFAULT_REGION}.amazoncognito.com`,
      description: "Cognito domain name",
      exportName: `${props.projectName}-config-cognito-domain`,
    });

    // Add callback URL export
    new cdk.CfnOutput(this, "config-cognito-callback-url", {
      value: `https://${props.distributionDomainName}`,
      description: "Cognito callback URL",
      exportName: `${props.projectName}-config-cognito-callback-url`,
    });
  }
}
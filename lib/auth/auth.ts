// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib'
import { CustomResource, Duration } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import { Architecture, IFunction, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import * as path from 'path'
import { Auth, CreateAdminUserProps } from '../../types'
import { addTemplateTag, getLambdaPowertoolsLayer } from '../../utils'

export interface AuthProps {
  readonly callbackUrl?: string
  // API Auth scopes. Can be used for testing. Defaults to false.
  readonly setAPIGWScopes?: boolean
}

export class CognitoAuth extends Construct implements Auth {
  public readonly userPool: cognito.IUserPool
  public readonly userPoolClient: cognito.IUserPoolClient
  public readonly userPoolDomain: cognito.IUserPoolDomain
  readonly jwtIssuer: string
  readonly jwtAudience: string[]
  readonly tokenEndpoint: string
  readonly fetchTenantScope?: string
  readonly fetchAllTenantsScope?: string
  readonly deleteTenantScope?: string
  readonly createTenantScope?: string
  readonly updateTenantScope?: string
  readonly activateTenantScope?: string
  readonly deactivateTenantScope?: string
  readonly fetchUserScope?: string
  readonly fetchAllUsersScope?: string
  readonly deleteUserScope?: string
  readonly createUserScope?: string
  readonly updateUserScope?: string
  readonly disableUserScope?: string
  readonly enableUserScope?: string
  readonly wellKnownEndpointUrl: string
  readonly createUserFunction: IFunction
  readonly fetchAllUsersFunction: IFunction
  readonly fetchUserFunction: IFunction
  readonly updateUserFunction: IFunction
  readonly deleteUserFunction: IFunction
  readonly disableUserFunction: IFunction
  readonly enableUserFunction: IFunction
  private readonly createAdminUserFunction: IFunction

  constructor(scope: Construct, id: string, props?: AuthProps) {
    super(scope, id)

    addTemplateTag(this, 'CognitioAuthImpl')
    const defaultControlPlaneCallbackURL = 'http://localhost'
    const controlPlaneCallbackURL =
      props?.callbackUrl || defaultControlPlaneCallbackURL

    // Creates a UserPool with `userRole` custom attr
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      // featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: true,
      // signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      userInvitation: {
        emailSubject: 'Your temporary password for control plane UI',
        emailBody: `Login into control plane UI at ${controlPlaneCallbackURL} with username {username} and temporary password {####}`,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      customAttributes: {
        userRole: new cognito.StringAttribute({
          mutable: true,
          minLen: 1,
          maxLen: 256,
        }),
      },
    })

    /**
     * OAuth Resource Server Configurations and Scopes: This is how fine-grained access control is enforced across the services.
     */

    // User Scopes
    const readUserScope = new cognito.ResourceServerScope({
      scopeName: 'user_read',
      scopeDescription: 'Read access to users.',
    })
    const writeUserScope = new cognito.ResourceServerScope({
      scopeName: 'user_write',
      scopeDescription: 'Write access to users.',
    })
    const userResourceServer = this.userPool.addResourceServer(
      'UserResourceServer',
      {
        identifier: 'user',
        scopes: [readUserScope, writeUserScope],
      }
    )
    const userResourceServerReadScope = cognito.OAuthScope.resourceServer(
      userResourceServer,
      readUserScope
    )
    const userResourceServerWriteScope = cognito.OAuthScope.resourceServer(
      userResourceServer,
      writeUserScope
    )

    if (props?.setAPIGWScopes != false) {
      this.fetchUserScope = userResourceServerReadScope.scopeName
      this.fetchAllUsersScope = userResourceServerReadScope.scopeName
      this.deleteUserScope = userResourceServerWriteScope.scopeName
      this.createUserScope = userResourceServerWriteScope.scopeName
      this.updateUserScope = userResourceServerWriteScope.scopeName
      this.disableUserScope = userResourceServerWriteScope.scopeName
      this.enableUserScope = userResourceServerWriteScope.scopeName
    }

    // Tenant Scopes
    const readTenantScope = new cognito.ResourceServerScope({
      scopeName: 'tenant_read',
      scopeDescription: 'Read access to tenants.',
    })
    const writeTenantScope = new cognito.ResourceServerScope({
      scopeName: 'tenant_write',
      scopeDescription: 'Write access to tenants.',
    })
    const tenantResourceServer = this.userPool.addResourceServer(
      'TenantResourceServer',
      {
        identifier: 'tenant',
        scopes: [readTenantScope, writeTenantScope],
      }
    )
    const tenantResourceServerReadScope = cognito.OAuthScope.resourceServer(
      tenantResourceServer,
      readTenantScope
    )
    const tenantResourceServerWriteScope = cognito.OAuthScope.resourceServer(
      tenantResourceServer,
      writeTenantScope
    )

    if (props?.setAPIGWScopes != false) {
      this.fetchTenantScope = tenantResourceServerReadScope.scopeName
      this.fetchAllTenantsScope = tenantResourceServerReadScope.scopeName
      this.deleteTenantScope = tenantResourceServerWriteScope.scopeName
      this.createTenantScope = tenantResourceServerWriteScope.scopeName
      this.updateTenantScope = tenantResourceServerWriteScope.scopeName
      this.activateTenantScope = tenantResourceServerWriteScope.scopeName
      this.deactivateTenantScope = tenantResourceServerWriteScope.scopeName
    }

    /**
     * UserPoolClient and UserPoolDomain
     */
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      generateSecret: false, // not needed for web clients
      authFlows: { userPassword: true, userSrp: true },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        callbackUrls: [controlPlaneCallbackURL],
        logoutUrls: [controlPlaneCallbackURL],
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          tenantResourceServerReadScope,
          tenantResourceServerWriteScope,
          userResourceServerReadScope,
          userResourceServerWriteScope,
        ],
      },
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('userRole'),
    })

    // this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
    //   userPool: this.userPool,
    //   cognitoDomain: {
    //     domainPrefix: `${cdk.Stack.of(this).account}-${this.node.addr.substring(
    //       0,
    //       6
    //     )}`,
    //   },
    // })

    /**
     * OIDC and JWT Configuration
     */
    const region = cdk.Stack.of(this).region
    this.wellKnownEndpointUrl = `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/openid-configuration`
    // this.tokenEndpoint = `https://${this.userPoolDomain.domainName}.auth.${region}.amazoncognito.com/oauth2/token`
    this.jwtIssuer = `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}`
    this.jwtAudience = [this.userPoolClient.userPoolClientId]

    /**
     * User Management Lambda and IAM Role
     */
    const userManagementExecRole = new Role(this, 'userManagementExecRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    })
    userManagementExecRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      )
    )
    userManagementExecRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'CloudWatchLambdaInsightsExecutionRolePolicy'
      )
    )
    userManagementExecRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AWSXrayWriteOnlyAccess')
    )
    userManagementExecRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminGetUser',
          'cognito-idp:ListUsers',
        ],
        effect: Effect.ALLOW,
        resources: ['*'],
      })
    )

    const powerToolsLayer = getLambdaPowertoolsLayer(this)
    const userManagementServices = new NodejsFunction(
      this,
      'UserManagementServices',
      {
        entry: path.join(__dirname, '../../lambda/userManagement.ts'),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        handler: 'handler',
        timeout: Duration.seconds(30),
        role: userManagementExecRole,
        layers: [powerToolsLayer],
        environment: {
          USER_POOL_ID: this.userPool.userPoolId,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: [
            '@aws-lambda-powertools/logger',
            '@aws-lambda-powertools/tracer',
            '@aws-lambda-powertools/metrics',
          ],
        },
      }
    )

    this.createUserFunction = userManagementServices
    this.fetchAllUsersFunction = userManagementServices
    this.fetchUserFunction = userManagementServices
    this.updateUserFunction = userManagementServices
    this.deleteUserFunction = userManagementServices
    this.disableUserFunction = userManagementServices
    this.enableUserFunction = userManagementServices

    // Create Admin Custom Resource Lambda
    this.createAdminUserFunction = new NodejsFunction(
      this,
      'createAdminUserFunction',
      {
        entry: path.join(__dirname, '../../lambda/authCustomResource.ts'),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        handler: 'handler',
        timeout: Duration.seconds(60),
        layers: [powerToolsLayer],
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: [
            '@aws-lambda-powertools/logger',
            '@aws-lambda-powertools/tracer',
            '@aws-lambda-powertools/metrics',
            '@aws-sdk/client-cognito-identity-provider',
          ],
        },
      }
    )

    this.userPool.grant(
      this.createAdminUserFunction,
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminDeleteUser'
    )

    /**
     * Outputs
     */
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    })
    // new cdk.CfnOutput(this, 'UserPoolDomain', {
    //   value: this.userPoolDomain.domainName,
    // })
  }

  // This Custom Resource invokes the above `createAdminUserFunction` Lambda during stack deployment
  createAdminUser(scope: Construct, id: string, props: CreateAdminUserProps) {
    const customResource = new CustomResource(
      scope,
      `createAdminUserCustomResource-${id}`,
      {
        serviceToken: this.createAdminUserFunction.functionArn,
        properties: {
          UserPoolId: this.userPool.userPoolId,
          Name: props.name,
          Email: props.email,
          Role: props.role,
        },
      }
    )

    // Apply a stable PhysicalResourceId to prevent unnecessary invocations
    const resource = customResource.node.defaultChild as cdk.CfnResource
    resource.addOverride(
      'Properties.PhysicalResourceId',
      'singleton-custom-resource-1'
    )
  }
}

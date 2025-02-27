// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration } from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpIamAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import * as path from 'path'
import { ApiRoute, Auth, DetailType, EventManager } from '../../types'
import {
  addTemplateTag,
  generateRoutes,
  getLambdaPowertoolsLayer,
} from '../../utils'
import { TenantManagementService } from './tenant-management'

export interface TenantRegistrationServiceProps {
  readonly api: apigatewayv2.HttpApi
  readonly auth: Auth
  readonly authorizer: apigatewayv2.IHttpRouteAuthorizer
  readonly eventBus: EventManager
  readonly tenantManagementService: TenantManagementService
}

export class TenantRegistrationService extends Construct {
  public readonly table: dynamodb.ITableV2
  public readonly tenantRegistrationsPath: string = '/tenant-registrations'
  public readonly tenantRegistrationIdColumn: string = 'tenantRegistrationId'
  public readonly tenantRegistrationsIdPath: string = `${this.tenantRegistrationsPath}/{${this.tenantRegistrationIdColumn}}`

  constructor(
    scope: Construct,
    id: string,
    props: TenantRegistrationServiceProps
  ) {
    super(scope, id)
    addTemplateTag(this, 'TenantRegistrationService')

    // Creates a DynamoDB table for tenant registrations
    const tenantRegistrationTable = new dynamodb.TableV2(
      this,
      'TenantRegistrationTable',
      {
        partitionKey: {
          name: this.tenantRegistrationIdColumn,
          type: dynamodb.AttributeType.STRING,
        },
        billing: dynamodb.Billing.onDemand(),
        // pointInTimeRecovery: true, // Optionally
      }
    )

    // Creates a Lambda function for tenant registration operations
    const tenantRegistrationLambda = new NodejsFunction(
      this,
      'TenantRegistrationLambda',
      {
        entry: path.join(__dirname, '../../lambda/tenantRegistration.ts'),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        handler: 'handler',
        timeout: Duration.seconds(60),
        layers: [getLambdaPowertoolsLayer(this)],
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: [
            '@aws-lambda-powertools/logger',
            '@aws-lambda-powertools/tracer',
            '@aws-lambda-powertools/metrics',
            '@aws-sdk/lib-dynamodb',
            '@aws-sdk/client-eventbridge',
            '@aws-sdk/credential-provider-node',
            '@aws-sdk/protocol-http',
            '@aws-sdk/signature-v4',
          ],
        },
        environment: {
          TENANT_REGISTRATION_TABLE_NAME: tenantRegistrationTable.tableName,
          TENANT_API_URL: props.api.url!,
          EVENTBUS_NAME: props.eventBus.busName,
          EVENT_SOURCE: props.eventBus.controlPlaneEventSource,
          ONBOARDING_DETAIL_TYPE: DetailType.ONBOARDING_REQUEST,
          OFFBOARDING_DETAIL_TYPE: DetailType.OFFBOARDING_REQUEST,
        },
      }
    )

    /**
     * Permissions
     */
    tenantRegistrationTable.grantReadWriteData(tenantRegistrationLambda)
    props.eventBus.grantPutEventsTo(tenantRegistrationLambda)
    tenantRegistrationLambda.role?.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ['execute-api:Invoke'],
        resources: [
          props.api.arnForExecuteApi(
            'POST',
            props.tenantManagementService.tenantsPath,
            props.api.defaultStage?.stageName
          ),
          props.api.arnForExecuteApi(
            'DELETE',
            `${props.tenantManagementService.tenantsPath}/*`,
            props.api.defaultStage?.stageName
          ),
          props.api.arnForExecuteApi(
            'PUT',
            `${props.tenantManagementService.tenantsPath}/*`,
            props.api.defaultStage?.stageName
          ),
        ],
      })
    )

    /**
     * API Routes for tenant registration endpoints
     */
    const tenantRegistrationHttpLambdaIntegration =
      new integrations.HttpLambdaIntegration(
        'tenantRegistrationHttpLambdaIntegration',
        tenantRegistrationLambda
      )

    const routes: ApiRoute[] = [
      {
        method: apigatewayv2.HttpMethod.GET,
        scope: props.auth.fetchAllTenantRegistrationsScope,
        path: this.tenantRegistrationsPath,
        integration: tenantRegistrationHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.POST,
        scope: props.auth.createTenantRegistrationScope,
        path: this.tenantRegistrationsPath,
        integration: tenantRegistrationHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.DELETE,
        scope: props.auth.deleteTenantRegistrationScope,
        path: this.tenantRegistrationsIdPath,
        integration: tenantRegistrationHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.GET,
        scope: props.auth.fetchTenantRegistrationScope,
        path: this.tenantRegistrationsIdPath,
        integration: tenantRegistrationHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.PATCH,
        authorizer: new HttpIamAuthorizer(),
        scope: props.auth.updateTenantRegistrationScope,
        path: this.tenantRegistrationsIdPath,
        integration: tenantRegistrationHttpLambdaIntegration,
      },
    ]
    generateRoutes(props.api, routes, props.authorizer)

    /**
     * EventBridge
     */

    // Create a Lambda function that will update the tenant registration table based on events
    const tenantRegistrationStatusUpdaterLambda = new NodejsFunction(
      this,
      'TenantRegistrationStatusUpdaterLambda',
      {
        entry: path.join(
          __dirname,
          '../../lambda/tenantRegistrationStatusUpdater.ts'
        ),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        handler: 'handler',
        timeout: Duration.seconds(30),
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: [
            '@aws-lambda-powertools/logger',
            '@aws-lambda-powertools/tracer',
            '@aws-lambda-powertools/metrics',
            '@aws-sdk/lib-dynamodb',
            '@aws-sdk/credential-provider-node',
            '@aws-sdk/protocol-http',
            '@aws-sdk/signature-v4',
          ],
        },
        environment: {
          TENANT_API_URL: props.api.url!,
          TENANT_REGISTRATION_PATH: this.tenantRegistrationsPath,
        },
      }
    )

    // Add the Lambda as the target of the rule. We map event fields into the Lambda input
    const tenantRegistrationUpdateServiceTarget = new targets.LambdaFunction(
      tenantRegistrationStatusUpdaterLambda,
      {
        event: events.RuleTargetInput.fromObject({
          tenantRegistrationId: events.EventField.fromPath(
            '$.detail.tenantRegistrationId'
          ),
          jobOutput: events.EventField.fromPath('$.detail.jobOutput'),
        }),
      }
    )

    // Create an EventBridge rule to trigger the status updater for these specific detail types
    ;[
      DetailType.PROVISION_SUCCESS,
      DetailType.PROVISION_FAILURE,
      DetailType.DEPROVISION_SUCCESS,
      DetailType.DEPROVISION_FAILURE,
    ].forEach((detailType) => {
      props.eventBus.addTargetToEvent(this, {
        eventType: detailType,
        target: tenantRegistrationUpdateServiceTarget,
      })
    })

    this.table = tenantRegistrationTable
  }
}

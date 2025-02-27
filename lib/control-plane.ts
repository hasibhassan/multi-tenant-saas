// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib'
import { CorsPreflightOptions } from 'aws-cdk-lib/aws-apigatewayv2'
import { Construct } from 'constructs'
import { Auth, EventManager } from '../types'
import { addTemplateTag } from '../utils'
import { ControlPlaneAPI } from './api'
import { CognitoAuth } from './auth/auth'
import { SharedEventBus } from './event-bus'
import { TenantManagementService } from './tenant-management/tenant-management'
import { TenantRegistrationService } from './tenant-management/tenant-registration'
import { UserManagementService } from './user-management/user-management'

export interface ControlPlaneProps {
  readonly auth?: Auth
  readonly systemAdminEmail: string // Email of system admin user
  readonly systemAdminName?: string // Name of system admin
  readonly systemAdminRoleName?: string // Name of system admin role
  readonly billing?: any // Billing provider config
  readonly metering?: any // Metering provider config
  readonly eventBus?: EventManager
  readonly disableAPILogging?: boolean // If true, the API Gateway will not log requests to the CloudWatch Logs
  readonly apiCorsConfig?: CorsPreflightOptions
}

export class ControlPlane extends Construct {
  public readonly controlPlaneAPIUrl: string
  public readonly eventBus: EventManager

  constructor(scope: Construct, id: string, props: ControlPlaneProps) {
    super(scope, id)
    addTemplateTag(this, 'ControlPlane')

    const systemAdminName = props.systemAdminName || 'admin'
    const systemAdminRoleName = props.systemAdminRoleName || 'SystemAdmin'

    /**
     * Auth
     */
    const auth =
      props.auth ||
      new CognitoAuth(this, 'CognitoAuth', {
        callbackUrl: 'https://your-app.example.com/callback', // TODO
      })

    auth.createAdminUser(this, 'adminUser', {
      email: props.systemAdminEmail,
      name: systemAdminName,
      role: systemAdminRoleName,
    })

    /**
     * API
     */
    const api = new ControlPlaneAPI(this, 'controlPlaneApi', {
      auth,
      disableAPILogging: props.disableAPILogging,
      apiCorsConfig: props.apiCorsConfig,
    })

    /**
     * Event Bus
     */
    const eventBus =
      props.eventBus ?? new SharedEventBus(this, 'SharedEventBus')

    /**
     * Services
     */
    const tenantManagementService = new TenantManagementService(
      this,
      'tenantManagementService',
      {
        api: api.api,
        auth,
        authorizer: api.jwtAuthorizer,
        eventBus,
      }
    )

    new TenantRegistrationService(this, 'tenantRegistrationService', {
      api: api.api,
      auth,
      authorizer: api.jwtAuthorizer,
      eventBus,
      tenantManagementService,
    })

    new UserManagementService(this, 'userManagementService', {
      api: api.api,
      auth,
      jwtAuthorizer: api.jwtAuthorizer,
    })

    // Optionally add billing and metering providers. Examples:
    // if (props.billing) {
    //   const billingService = new BillingService(this, 'BillingService', {
    //     billing: props.billing,
    //     eventBus: eventBus,
    //     controlPlaneAPI: api.api,
    //   })

    //   if (billingService.controlPlaneAPIBillingWebhookResourcePath) {
    //     new cdk.CfnOutput(this, 'billingWebhookURL', {
    //       value: `${api.apiUrl}${billingService.controlPlaneAPIBillingWebhookResourcePath}`,
    //       key: 'billingWebhookURL',
    //     })
    //   }
    // }

    // if (props.metering) {
    //   new MeteringService(this, 'MeteringService', {
    //     metering: props.metering,
    //     api: { api, jwtAuthorizer: undefined },
    //   })
    // }

    this.controlPlaneAPIUrl = api.apiUrl
    this.eventBus = eventBus

    new cdk.CfnOutput(this, 'ControlPlaneAPIEndpoint', {
      value: this.controlPlaneAPIUrl,
    })
    new cdk.CfnOutput(this, 'eventBridgeArn', {
      value: eventBus.busArn,
      key: 'eventBridgeArn',
    })
  }
}

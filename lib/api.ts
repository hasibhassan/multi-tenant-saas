// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayV2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { Construct } from 'constructs'
import { Auth } from '../types/Auth'
import { addTemplateTag } from '../utils/addTemplateTag'

export interface ControlPlaneAPIProps {
  readonly auth: Auth
  readonly disableAPILogging?: boolean

  // Settings for Cors Configuration for the ControlPlane API.
  readonly apiCorsConfig?: apigatewayv2.CorsPreflightOptions
}

export class ControlPlaneAPI extends Construct {
  public readonly api: apigatewayv2.HttpApi
  apiUrl: any
  jwtAuthorizer: apigatewayv2.IHttpRouteAuthorizer

  constructor(scope: Construct, id: string, props: ControlPlaneAPIProps) {
    super(scope, id)
    addTemplateTag(this, 'ControlPlaneAPI')

    /**
     * API Gateway HTTP API
     */
    this.api = new apigatewayv2.HttpApi(this, 'controlPlaneAPI', {
      corsPreflight: props.apiCorsConfig,
    })
    this.apiUrl = this.api.url

    this.jwtAuthorizer = new apigatewayV2Authorizers.HttpJwtAuthorizer(
      'tenantsAuthorizer',
      props.auth.jwtIssuer,
      {
        jwtAudience: props.auth.jwtAudience,
      }
    )

    // if (props.disableAPILogging) {
    // } else {
    //   const controlPlaneAPILogGroup = new LogGroup(
    //     this,
    //     'controlPlaneAPILogGroup',
    //     {
    //       retention: RetentionDays.ONE_WEEK,
    //       logGroupName: `/aws/vendedlogs/api/${this.node.id}-${this.node.addr}`,
    //     }
    //   )
    //   const accessLogSettings = {
    //     destinationArn: controlPlaneAPILogGroup.logGroupArn,
    //     format: JSON.stringify({
    //       requestId: '$context.requestId',
    //       ip: '$context.identity.sourceIp',
    //       requestTime: '$context.requestTime',
    //       httpMethod: '$context.httpMethod',
    //       routeKey: '$context.routeKey',
    //       status: '$context.status',
    //       protocol: '$context.protocol',
    //       responseLength: '$context.responseLength',
    //     }),
    //   }
    //   const stage = this.api.defaultStage?.node
    //     .defaultChild as apigatewayV2.CfnStage
    //   stage.accessLogSettings = accessLogSettings
    // }

    new cdk.CfnOutput(this, 'controlPlaneAPIEndpoint', {
      value: this.apiUrl,
      key: 'controlPlaneAPIEndpoint',
    })
  }
}

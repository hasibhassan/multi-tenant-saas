// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as apigatewayV2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { Construct } from 'constructs'
import { ApiRoute, Auth } from '../../types'
import { generateRoutes } from '../../utils'

export interface UserManagementServiceProps {
  api: apigatewayV2.HttpApi
  auth: Auth
  jwtAuthorizer: apigatewayV2.IHttpRouteAuthorizer
}

export class UserManagementService extends Construct {
  public readonly usersPath = '/users'
  public readonly userIdPath = `${this.usersPath}/{userId}`

  constructor(scope: Construct, id: string, props: UserManagementServiceProps) {
    super(scope, id)

    const routes: ApiRoute[] = [
      {
        method: apigatewayV2.HttpMethod.POST,
        scope: props.auth.createUserScope,
        path: this.usersPath,
        integration: new HttpLambdaIntegration(
          'createUserHttpLambdaIntegration',
          props.auth.createUserFunction
        ),
      },
      {
        method: apigatewayV2.HttpMethod.GET,
        scope: props.auth.fetchAllUsersScope,
        path: this.usersPath,
        integration: new HttpLambdaIntegration(
          'fetchAllUsersHttpLambdaIntegration',
          props.auth.fetchAllUsersFunction
        ),
      },
      {
        method: apigatewayV2.HttpMethod.GET,
        scope: props.auth.fetchUserScope,
        path: this.userIdPath,
        integration: new HttpLambdaIntegration(
          'fetchUserHttpLambdaIntegration',
          props.auth.fetchUserFunction
        ),
      },
      {
        method: apigatewayV2.HttpMethod.PUT,
        scope: props.auth.updateUserScope,
        path: this.userIdPath,
        integration: new HttpLambdaIntegration(
          'updateUserHttpLambdaIntegration',
          props.auth.updateUserFunction
        ),
      },
      {
        method: apigatewayV2.HttpMethod.DELETE,
        scope: props.auth.deleteUserScope,
        path: this.userIdPath,
        integration: new HttpLambdaIntegration(
          'deleteUserHttpLambdaIntegration',
          props.auth.deleteUserFunction
        ),
      },
    ]

    generateRoutes(props.api, routes, props.jwtAuthorizer)
  }
}

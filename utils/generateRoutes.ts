import * as apigatewayV2 from 'aws-cdk-lib/aws-apigatewayv2'
import { ApiRoute } from '../types/ApiRoute'

export interface IRoute {
  readonly method: apigatewayV2.HttpMethod
  readonly scope?: string
  readonly path: string
  readonly integration: apigatewayV2.HttpRouteIntegration
  readonly authorizer?: apigatewayV2.IHttpRouteAuthorizer
}

export const generateRoutes = (
  api: apigatewayV2.HttpApi,
  routes: ApiRoute[],
  authorizer?: apigatewayV2.IHttpRouteAuthorizer
) => {
  let allRoutes: apigatewayV2.HttpRoute[] = []

  routes.forEach((route) => {
    allRoutes = [
      ...api.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: route.integration,
        authorizer: route.authorizer || authorizer,
        authorizationScopes: route?.scope ? [route.scope] : [],
      }),
      ...allRoutes,
    ]
  })

  return allRoutes
}

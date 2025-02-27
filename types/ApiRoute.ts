import * as apigatewayV2 from 'aws-cdk-lib/aws-apigatewayv2'

export interface ApiRoute {
  readonly method: apigatewayV2.HttpMethod
  readonly scope?: string
  readonly path: string
  readonly integration: apigatewayV2.HttpRouteIntegration
  readonly authorizer?: apigatewayV2.IHttpRouteAuthorizer
}

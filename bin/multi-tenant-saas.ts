#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import 'source-map-support/register'
import { ControlPlane } from '../lib/control-plane'
import { FrontendDeploymentStack } from '../lib/frontend/frontend-deployment-stack'

const app = new cdk.App()

// Create a stack for the ControlPlane construct
const controlPlaneStack = new cdk.Stack(app, 'ControlPlaneStack')

new ControlPlane(controlPlaneStack, 'ControlPlane', {
  systemAdminEmail: process.env.SYSTEM_ADMIN_EMAIL || '', // Enter your email here
  apiCorsConfig: {
    allowOrigins: [process.env.FRONTEND_DOMAIN || '*'], // Allow all if not set
    allowMethods: [
      apigatewayv2.CorsHttpMethod.GET,
      apigatewayv2.CorsHttpMethod.POST,
      apigatewayv2.CorsHttpMethod.PUT,
      apigatewayv2.CorsHttpMethod.PATCH,
      apigatewayv2.CorsHttpMethod.DELETE,
      apigatewayv2.CorsHttpMethod.OPTIONS, // Optional, but good practice
    ],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowCredentials: true, // Required for JWT authentication
  },
})

// Instantiate the FrontendDeploymentStack directly as it's already a stack
new FrontendDeploymentStack(app, 'FrontendStack', {
  // additional properties if needed
})

app.synth()

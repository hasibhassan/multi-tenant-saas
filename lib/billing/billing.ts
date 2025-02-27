import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

export interface IBilling {
  createCustomerFunction: lambda.IFunction
  deleteCustomerFunction: lambda.IFunction
  putUsageFunction?: {
    handler: lambda.IFunction
    schedule: cdk.aws_events.Schedule
  }
  webhookFunction?: {
    handler: lambda.IFunction
    path: string
  }
}

export interface BillingProviderProps {
  billing: IBilling
  controlPlaneAPI: apigwv2.HttpApi
}

export class BillingProvider extends Construct {
  public readonly billingWebhookPath?: string

  constructor(scope: Construct, id: string, props: BillingProviderProps) {
    super(scope, id)

    if (props.billing.webhookFunction) {
      this.billingWebhookPath = `/billing/${props.billing.webhookFunction.path}`
      props.controlPlaneAPI.addRoutes({
        path: this.billingWebhookPath,
        methods: [apigwv2.HttpMethod.POST],
        integration: new integrations.HttpLambdaIntegration(
          'BillingWebhookIntegration',
          props.billing.webhookFunction.handler
        ),
      })
    }

    // Additional event integration (e.g. scheduling) can be added here if needed.
  }
}

import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

export interface IMetering {
  fetchUsageFunction: { handler: lambda.IFunction; scope?: string }
  fetchMeterFunction: { handler: lambda.IFunction; scope?: string }
  fetchAllMetersFunction: { handler: lambda.IFunction; scope?: string }
  createMeterFunction: { handler: lambda.IFunction; scope?: string }
  updateMeterFunction?: { handler: lambda.IFunction; scope?: string }
  deleteMeterFunction?: { handler: lambda.IFunction; scope?: string }
  // Additional functions for ingesting usage events, etc.
}

export interface MeteringProviderProps {
  metering: IMetering
  api: { api: apigwv2.HttpApi; jwtAuthorizer?: any }
}

export class MeteringProvider extends Construct {
  constructor(scope: Construct, id: string, props: MeteringProviderProps) {
    super(scope, id)

    const usagePath = '/usage'
    const metersPath = '/meters'

    props.api.api.addRoutes({
      path: `${usagePath}/{meterId}`,
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'FetchUsageIntegration',
        props.metering.fetchUsageFunction.handler
      ),
    })

    props.api.api.addRoutes({
      path: `${metersPath}/{meterId}`,
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'FetchMeterIntegration',
        props.metering.fetchMeterFunction.handler
      ),
    })

    props.api.api.addRoutes({
      path: metersPath,
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'FetchAllMetersIntegration',
        props.metering.fetchAllMetersFunction.handler
      ),
    })

    props.api.api.addRoutes({
      path: metersPath,
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'CreateMeterIntegration',
        props.metering.createMeterFunction.handler
      ),
    })

    if (props.metering.updateMeterFunction) {
      props.api.api.addRoutes({
        path: `${metersPath}/{meterId}`,
        methods: [apigwv2.HttpMethod.PUT],
        integration: new integrations.HttpLambdaIntegration(
          'UpdateMeterIntegration',
          props.metering.updateMeterFunction.handler
        ),
      })
    }

    if (props.metering.deleteMeterFunction) {
      props.api.api.addRoutes({
        path: `${metersPath}/{meterId}`,
        methods: [apigwv2.HttpMethod.DELETE],
        integration: new integrations.HttpLambdaIntegration(
          'DeleteMeterIntegration',
          props.metering.deleteMeterFunction.handler
        ),
      })
    }
  }
}

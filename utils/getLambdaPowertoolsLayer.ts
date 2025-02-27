import { Stack } from 'aws-cdk-lib'
import { LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

export const getLambdaPowertoolsLayer = (scope: Construct) =>
  LayerVersion.fromLayerVersionArn(
    scope,
    'PowertoolsLayer',
    `arn:aws:lambda:${
      Stack.of(scope).region
    }:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:20`
  )

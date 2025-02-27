// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IFunction } from 'aws-cdk-lib/aws-lambda'
import { DetailType } from './EventManager'

/**
 * Represents a function that is triggered synchronously via an API Gateway.
 */
export interface ISyncFunction {
  /**
   * The function definition.
   */
  readonly handler: IFunction

  /**
   * The scope required to authorize access to this function.
   * This is set in the API Gateway.
   * If it is not provided, the API Gateway will not check for any scopes on the token.
   */
  readonly scope?: string
}

/**
 * Represents a function that is triggered asynchronously via an event.
 */
export interface IASyncFunction {
  /**
   * The function definition.
   */
  readonly handler: IFunction

  /**
   * The detail-type that will trigger the handler function.
   */
  readonly trigger?: DetailType
}

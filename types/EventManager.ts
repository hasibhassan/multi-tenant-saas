// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IRuleTarget } from 'aws-cdk-lib/aws-events'
import { IGrantable } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

/**
 * Provides an easy way of accessing event detail types.
 * The string values represent the "detail-type" used in
 * events sent across the EventBus.
 */
export enum DetailType {
  /**
   * Event detail type for onboarding request.
   */
  ONBOARDING_REQUEST = 'onboardingRequest',
  /**
   * Event detail type for successful onboarding.
   */
  ONBOARDING_SUCCESS = 'onboardingSuccess',
  /**
   * Event detail type for failed onboarding.
   */
  ONBOARDING_FAILURE = 'onboardingFailure',

  /**
   * Event detail type for offboarding request.
   */
  OFFBOARDING_REQUEST = 'offboardingRequest',
  /**
   * Event detail type for successful offboarding.
   */
  OFFBOARDING_SUCCESS = 'offboardingSuccess',
  /**
   * Event detail type for failed offboarding.
   */
  OFFBOARDING_FAILURE = 'offboardingFailure',

  /**
   * Event detail type for successful provisioning.
   */
  PROVISION_SUCCESS = 'provisionSuccess',
  /**
   * Event detail type for failed provisioning.
   */
  PROVISION_FAILURE = 'provisionFailure',

  /**
   * Event detail type for successful deprovisioning.
   */
  DEPROVISION_SUCCESS = 'deprovisionSuccess',
  /**
   * Event detail type for failed deprovisioning.
   */
  DEPROVISION_FAILURE = 'deprovisionFailure',

  /**
   * Event detail type for successful billing configuration.
   */
  BILLING_SUCCESS = 'billingSuccess',
  /**
   * Event detail type for failure to configure billing.
   */
  BILLING_FAILURE = 'billingFailure',

  /**
   * Event detail type for activation request.
   */
  ACTIVATE_REQUEST = 'activateRequest',
  /**
   * Event detail type for successful activation.
   */
  ACTIVATE_SUCCESS = 'activateSuccess',
  /**
   * Event detail type for failed activation.
   */
  ACTIVATE_FAILURE = 'activateFailure',

  /**
   * Event detail type for deactivation request.
   */
  DEACTIVATE_REQUEST = 'deactivateRequest',
  /**
   * Event detail type for successful deactivation.
   */
  DEACTIVATE_SUCCESS = 'deactivateSuccess',
  /**
   * Event detail type for failed deactivation.
   */
  DEACTIVATE_FAILURE = 'deactivateFailure',

  /**
   * Event detail type for user creation on the app-plane side.
   * Note that control plane components do not emit this event. This event
   * should be emitted by the application plane.
   */
  TENANT_USER_CREATED = 'tenantUserCreated',
  /**
   * Event detail type for user deletion on the app-plane side.
   * Note that control plane components do not emit this event. This event
   * should be emitted by the application plane.
   */
  TENANT_USER_DELETED = 'tenantUserDeleted',

  /**
   * Event detail type for ingesting a usage event.
   */
  INGEST_USAGE = 'ingestUsage',
}

/**
 * Represents a mapping between 'detailType' as the key and 'source' as the value.
 */
export type EventMetadata = {
  // key: Event 'detailType' -> value: Event 'source'
  [key: string]: string
  // [key in DetailType]: string; // Causes this error: Only string-indexed map types are supported
}

/**
 * Props for adding a target to an event.
 */
export interface AddTargetToEventProps {
  /**
   * The detail type of the event to add a target to.
   */
  readonly eventType: DetailType

  /**
   * The target that will be added to the event.
   */
  readonly target: IRuleTarget
}

export interface EventManager {
  /**
   * The event source used for events emitted by the application plane.
   */
  readonly applicationPlaneEventSource: string

  /**
   * The event source used for events emitted by the control plane.
   */
  readonly controlPlaneEventSource: string

  /**
   * The name of the bus that will be used to send and receive events.
   */
  readonly busName: string

  /**
   * The ARN/ID of the bus that will be used to send and receive events.
   */
  readonly busArn: string

  /**
   * List of recognized events that are available as triggers.
   */
  readonly supportedEvents: EventMetadata

  /**
   * Adds an IRuleTarget to an event.
   *
   * @param scope The scope in which to find (or create) the Rule.
   * @param props Object containing eventType (the detail type of the event to add a target to)
   * and target (the target that will be added to the event).
   */
  addTargetToEvent(scope: Construct, props: AddTargetToEventProps): void

  /**
   * Provides grantee the permissions to place events
   * on the EventManager bus.
   *
   * @param grantee The grantee resource that will be granted the permission(s).
   */
  grantPutEventsTo(grantee: IGrantable): void
}

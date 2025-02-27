// Modified from original source:
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventBus, IEventBus, Rule } from 'aws-cdk-lib/aws-events'
import { IGrantable } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import {
  AddTargetToEventProps,
  DetailType,
  EventManager,
  EventMetadata,
} from '../types/EventManager'
import { addTemplateTag } from '../utils/addTemplateTag'

export interface SharedEventBusProps {
  /**
   * The event bus to register new rules with. One will be created if not provided.
   */
  readonly eventBus?: IEventBus

  /**
   * The EventMetadata to use to update the event defaults.
   */
  readonly eventMetadata?: EventMetadata

  /**
   * The name of the event source for events coming from the control plane.
   */
  readonly controlPlaneEventSource?: string

  /**
   * The name of the event source for events coming from the application plane.
   */
  readonly applicationPlaneEventSource?: string
}

/**
 * Provides an SharedEventBus to interact with the EventBus shared with the control plane
 */
export class SharedEventBus extends Construct implements EventManager {
  public readonly eventBus: IEventBus
  public readonly busName: string
  public readonly busArn: string
  public readonly controlPlaneEventSource: string = 'controlPlaneEventSource' // The event source used for events emitted by the control plane.
  public readonly applicationPlaneEventSource: string =
    'applicationPlaneEventSource' // The event source used for events emitted by the application plane.
  public readonly supportedEvents: EventMetadata // List of recognized events that are available as triggers.

  constructor(scope: Construct, id: string, props?: SharedEventBusProps) {
    super(scope, id)
    addTemplateTag(this, 'SharedEventBus')

    this.eventBus =
      props?.eventBus ?? new EventBus(this, 'MultiTenantSharedEventBus')
    this.busName = this.eventBus.eventBusName
    this.busArn = this.eventBus.eventBusArn

    this.controlPlaneEventSource =
      props?.controlPlaneEventSource || this.controlPlaneEventSource
    this.applicationPlaneEventSource =
      props?.applicationPlaneEventSource || this.applicationPlaneEventSource

    // for every DetailType enum (such as onboardingRequest, activateSuccess, etc.), there should be a corresponding key in the supportedEvents map and their associated event source (either the control or application plane)
    this.supportedEvents = {
      onboardingRequest: this.controlPlaneEventSource,
      onboardingSuccess: this.applicationPlaneEventSource,
      onboardingFailure: this.applicationPlaneEventSource,
      offboardingRequest: this.controlPlaneEventSource,
      offboardingSuccess: this.applicationPlaneEventSource,
      offboardingFailure: this.applicationPlaneEventSource,
      provisionSuccess: this.applicationPlaneEventSource,
      provisionFailure: this.applicationPlaneEventSource,
      deprovisionSuccess: this.applicationPlaneEventSource,
      deprovisionFailure: this.applicationPlaneEventSource,
      billingSuccess: this.controlPlaneEventSource,
      billingFailure: this.controlPlaneEventSource,
      activateRequest: this.controlPlaneEventSource,
      activateSuccess: this.applicationPlaneEventSource,
      activateFailure: this.applicationPlaneEventSource,
      deactivateRequest: this.controlPlaneEventSource,
      deactivateSuccess: this.applicationPlaneEventSource,
      deactivateFailure: this.applicationPlaneEventSource,
      tenantUserCreated: this.controlPlaneEventSource,
      tenantUserDeleted: this.controlPlaneEventSource,
      ingestUsage: this.applicationPlaneEventSource,
    }

    for (const key in this.supportedEvents) {
      // update this.eventMetadata with any values passed in via props
      if (props?.eventMetadata && props?.eventMetadata[key]) {
        this.supportedEvents[key] = props.eventMetadata[key]
      }
    }
  }

  /**
   * Provides grantee the permissions to place events on the SharedEventBus. (gives another resource (a grantee) permission to send events to this bus.)
   *
   * @param grantee The grantee resource that will be granted the permission(s).
   */
  grantPutEventsTo(grantee: IGrantable) {
    this.eventBus.grantPutEventsTo(grantee)
  }

  /**
   * Adds an IRuleTarget to an event.
   *
   * @param scope The scope in which to find (or create) the Rule.
   * @param props Object containing eventType (the detail type of the event to add a target to)
   * and target (the target that will be added to the event).
   */
  addTargetToEvent(scope: Construct, props: AddTargetToEventProps): void {
    this.getOrCreateRule(scope, props.eventType).addTarget(props.target)
  }

  /**
   * Returns a Rule for the given eventType in the context of a scope.
   * A new one is created if the rule is not found in the scope.
   *
   * @param scope The scope in which to find (or create) the Rule.
   * @param eventType The detail type of the event to add a target to.
   * @returns A Rule for the given eventType in the provided scope.
   */
  private getOrCreateRule(scope: Construct, eventType: DetailType): Rule {
    let rule = scope.node.tryFindChild(`${eventType}Rule`) as Rule

    if (!rule) {
      rule = new Rule(scope, `${eventType}Rule`, {
        eventBus: this.eventBus,
        eventPattern: {
          source: [this.supportedEvents[eventType]],
          detailType: [eventType],
        },
      })
    }

    return rule
  }
}

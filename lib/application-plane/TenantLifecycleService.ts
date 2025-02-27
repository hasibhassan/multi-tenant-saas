import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions'
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { Construct } from 'constructs'

export interface TenantLifecycleManagerProps {
  // You can add additional configuration here if needed.
}

/**
 * A construct that creates two state machines: one for provisioning tenants
 * and one for deprovisioning tenants. It uses Lambda functions to simulate
 * the work and Step Functions to orchestrate the flow.
 */
export class TenantLifecycleManager extends Construct {
  // Expose the state machines so other parts of your app can start executions.
  public readonly provisioningStateMachine: stepFunctions.StateMachine
  public readonly deprovisioningStateMachine: stepFunctions.StateMachine

  constructor(
    scope: Construct,
    id: string,
    props?: TenantLifecycleManagerProps
  ) {
    super(scope, id)

    // -----------------------------
    // Provisioning Lambda Function
    // -----------------------------
    const provisioningLambda = new lambda.Function(
      this,
      'ProvisioningFunction',
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log("Provisioning tenant:", event.tenantId, "with plan:", event.plan);
          // Simulate some provisioning work (e.g. creating demo resources)
          return { status: 'success', tenantId: event.tenantId, plan: event.plan };
        };
      `),
        handler: 'index.handler',
      }
    )

    // -------------------------------
    // Deprovisioning Lambda Function
    // -------------------------------
    const deprovisioningLambda = new lambda.Function(
      this,
      'DeprovisioningFunction',
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log("Deprovisioning tenant:", event.tenantId);
          // Simulate some deprovisioning work (e.g. tearing down demo resources)
          return { status: 'success', tenantId: event.tenantId };
        };
      `),
        handler: 'index.handler',
      }
    )

    // ------------------------------------------------
    // Provisioning State Machine Definition (Step 1)
    // ------------------------------------------------
    // First, invoke the provisioning Lambda.
    const provisionTask = new tasks.LambdaInvoke(
      this,
      'InvokeProvisioningLambda',
      {
        lambdaFunction: provisioningLambda,
        outputPath: '$.Payload', // Use the Lambda’s output for the next steps.
      }
    )

    // Step 2: Branch based on the tenant's plan.
    const planChoice = new stepFunctions.Choice(this, 'SelectPlan')

    // For a "basic" plan.
    const basicPass = new stepFunctions.Pass(this, 'BasicPlanProvision', {
      result: stepFunctions.Result.fromObject({
        message: 'Provisioned basic plan resources',
      }),
    })

    // For an "essentials" plan.
    const essentialsPass = new stepFunctions.Pass(
      this,
      'EssentialsPlanProvision',
      {
        result: stepFunctions.Result.fromObject({
          message: 'Provisioned essentials plan resources',
        }),
      }
    )

    // For a "plus" plan.
    const plusPass = new stepFunctions.Pass(this, 'PlusPlanProvision', {
      result: stepFunctions.Result.fromObject({
        message: 'Provisioned plus plan resources',
      }),
    })

    // Assemble the provisioning workflow.
    const provisioningDefinition = provisionTask.next(
      planChoice
        .when(
          stepFunctions.Condition.stringEquals('$.plan', 'basic'),
          basicPass
        )
        .when(
          stepFunctions.Condition.stringEquals('$.plan', 'essentials'),
          essentialsPass
        )
        .when(stepFunctions.Condition.stringEquals('$.plan', 'plus'), plusPass)
        .otherwise(
          new stepFunctions.Fail(this, 'UnknownPlan', {
            error: 'UnknownPlanError',
            cause: 'The provided plan is not supported',
          })
        )
    )

    this.provisioningStateMachine = new stepFunctions.StateMachine(
      this,
      'ProvisioningStateMachine',
      {
        definition: provisioningDefinition,
        timeout: cdk.Duration.minutes(5),
      }
    )

    // -------------------------------------------------
    // Deprovisioning State Machine Definition (Single Task)
    // -------------------------------------------------
    const deprovisionTask = new tasks.LambdaInvoke(
      this,
      'InvokeDeprovisioningLambda',
      {
        lambdaFunction: deprovisioningLambda,
        outputPath: '$.Payload',
      }
    )

    this.deprovisioningStateMachine = new stepFunctions.StateMachine(
      this,
      'DeprovisioningStateMachine',
      {
        definition: deprovisionTask,
        timeout: cdk.Duration.minutes(5),
      }
    )
  }
}

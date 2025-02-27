import { Duration } from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpIamAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { AttributeType, ProjectionType } from 'aws-cdk-lib/aws-dynamodb'
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import * as path from 'path'
import { ApiRoute, Auth, EventManager } from '../../types'
import {
  addTemplateTag,
  generateRoutes,
  getLambdaPowertoolsLayer,
} from '../../utils'

export interface TenantManagementServiceProps {
  readonly api: apigatewayv2.HttpApi
  readonly auth: Auth
  readonly authorizer: apigatewayv2.IHttpRouteAuthorizer
  readonly eventBus: EventManager
}

export class TenantManagementService extends Construct {
  public readonly table: dynamodb.ITableV2
  public readonly tenantsPath: string = '/tenants'
  readonly tenantIdColumn: string = 'tenantId'
  readonly tenantIdPath: string = `${this.tenantsPath}/{${this.tenantIdColumn}}`
  readonly tenantConfigIndexName: string = 'tenantConfigIndex'
  readonly tenantNameColumn: string = 'tenantName'
  readonly tenantConfigColumn: string = 'tenantConfig'
  readonly tenantConfigPath = '/tenant-config'
  readonly tenantConfigNameResourcePath = `${this.tenantConfigPath}/{tenantName}`

  constructor(
    scope: Construct,
    id: string,
    props: TenantManagementServiceProps
  ) {
    super(scope, id)
    addTemplateTag(this, 'TenantManagementService')

    // Create a DynamoDB table for tenants.
    const tenantManagementTable = new dynamodb.TableV2(
      this,
      'TenantManagementTable',
      {
        partitionKey: {
          name: this.tenantIdColumn,
          type: dynamodb.AttributeType.STRING,
        },
        billing: dynamodb.Billing.onDemand(),
        // pointInTimeRecovery: true, // Optionally
      }
    )
    tenantManagementTable.addGlobalSecondaryIndex({
      indexName: this.tenantConfigIndexName,
      partitionKey: { name: this.tenantNameColumn, type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: [this.tenantConfigColumn],
    })

    /**
     * Tenant Management Lambda and API Routes
     */

    /**
     * Creates an IAM role for the Tenant Management Lambda function.
     * The role is granted read and write access to the Tenant Details table,
     * and the ability to put events to the Event Manager.
     * The role is also assigned the AWSLambdaBasicExecutionRole,
     * CloudWatchLambdaInsightsExecutionRolePolicy, and AWSXrayWriteOnlyAccess
     * managed policies.
     */
    const tenantManagementExecRole = new Role(
      this,
      'tenantManagementExecRole',
      {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      }
    )
    tenantManagementExecRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      )
    )
    tenantManagementExecRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'CloudWatchLambdaInsightsExecutionRolePolicy'
      )
    )
    tenantManagementExecRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AWSXrayWriteOnlyAccess')
    )

    tenantManagementTable.grantReadWriteData(tenantManagementExecRole)

    props.eventBus.grantPutEventsTo(tenantManagementExecRole)

    const powerToolsLayer = getLambdaPowertoolsLayer(this)
    const tenantManagementLambda = new NodejsFunction(
      this,
      'TenantManagementLambda',
      {
        entry: path.join(__dirname, '../../lambda/tenantManagement.ts'),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        handler: 'handler',
        timeout: Duration.seconds(60),
        layers: [powerToolsLayer],
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: [
            '@aws-lambda-powertools/logger',
            '@aws-lambda-powertools/tracer',
            '@aws-lambda-powertools/metrics',
          ],
        },
        environment: {
          TENANT_DETAILS_TABLE_NAME: tenantManagementTable.tableName,
        },
        role: tenantManagementExecRole,
      }
    )

    const tenantManagementHttpLambdaIntegration =
      new integrations.HttpLambdaIntegration(
        'TenantManagementHttpLambdaIntegration',
        tenantManagementLambda
      )

    const tenantManagementRoutes: ApiRoute[] = [
      {
        method: apigatewayv2.HttpMethod.GET,
        path: this.tenantsPath,
        authorizer: props.authorizer,
        integration: tenantManagementHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.POST,
        path: this.tenantsPath,
        integration: tenantManagementHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.DELETE,
        path: this.tenantIdPath,
        integration: tenantManagementHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.GET,
        path: this.tenantIdPath,
        authorizer: props.authorizer,
        integration: tenantManagementHttpLambdaIntegration,
      },
      {
        method: apigatewayv2.HttpMethod.PUT,
        path: this.tenantIdPath,
        integration: tenantManagementHttpLambdaIntegration,
      },
    ]
    generateRoutes(props.api, tenantManagementRoutes, new HttpIamAuthorizer())

    /**
     * Tenant Config Lambda and API Routes
     */
    const tenantConfigLambda = new NodejsFunction(this, 'TenantConfigLambda', {
      entry: path.join(__dirname, '../../lambda/tenantConfig.ts'),
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      handler: 'handler',
      timeout: Duration.seconds(60),
      layers: [powerToolsLayer],
      bundling: {
        format: OutputFormat.ESM,
        minify: true,
        esbuildArgs: {
          '--tree-shaking': 'true',
        },
        sourceMap: true,
        banner:
          "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        externalModules: [
          '@aws-lambda-powertools/logger',
          '@aws-lambda-powertools/tracer',
          '@aws-lambda-powertools/metrics',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb',
        ],
      },
      environment: {
        TENANT_DETAILS_TABLE_NAME: tenantManagementTable.tableName,
        TENANT_CONFIG_INDEX_NAME: this.tenantConfigIndexName,
        TENANT_NAME_COLUMN: this.tenantNameColumn,
        TENANT_CONFIG_COLUMN: this.tenantNameColumn,
      },
    })

    const tenantConfigHttpLambdaIntegration =
      new integrations.HttpLambdaIntegration(
        'tenantConfigHttpLambdaIntegration',
        tenantConfigLambda
      )

    const tenantConfigRoutes: ApiRoute[] = [
      {
        path: this.tenantConfigPath,
        integration: tenantConfigHttpLambdaIntegration,
        method: apigatewayv2.HttpMethod.GET,
      },
      {
        path: this.tenantConfigNameResourcePath,
        integration: tenantConfigHttpLambdaIntegration,
        method: apigatewayv2.HttpMethod.GET,
      },
    ]
    generateRoutes(props.api, tenantConfigRoutes)

    this.table = tenantManagementTable
  }
}

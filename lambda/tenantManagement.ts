import type { LambdaInterface } from '@aws-lambda-powertools/commons/types'
import { Logger } from '@aws-lambda-powertools/logger'
import { Tracer } from '@aws-lambda-powertools/tracer'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda'
import { randomUUID } from 'crypto'

// Initialize Powertools Logger and Tracer
const tracer = new Tracer({ serviceName: 'tenant-management-service' })
const logger = new Logger()

// Get the table name from environment variables
const TENANT_DETAILS_TABLE = process.env.TENANT_DETAILS_TABLE_NAME!
if (!TENANT_DETAILS_TABLE) {
  throw new Error('TENANT_DETAILS_TABLE_NAME is not defined')
}

// Initialize DynamoDB clients
const ddbClient = new DynamoDBClient({})
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)

/**
 * Helper function to update a tenant using a dynamic update expression.
 */
const updateTenant = async (
  tenantId: string,
  tenant: Record<string, any>
): Promise<Record<string, any>> => {
  // Exclude tenantId from the update attributes if provided.
  const inputDetails = Object.keys(tenant).reduce((acc, key) => {
    if (key !== 'tenantId') {
      acc[key] = tenant[key]
    }
    return acc
  }, {} as Record<string, any>)

  // Build the update expression parts and values.
  const expressionParts: string[] = []
  const expressionAttributeValues: Record<string, any> = {}

  Object.keys(inputDetails).forEach((key) => {
    const attrKey = `:${key}`
    expressionParts.push(`${key} = ${attrKey}`)
    expressionAttributeValues[attrKey] = inputDetails[key]
  })

  const updateExpression = `set ${expressionParts.join(', ')}`

  const command = new UpdateCommand({
    TableName: TENANT_DETAILS_TABLE,
    Key: { tenantId },
    // Ensure the tenant exists
    ConditionExpression: 'tenantId = :tenantId',
    ExpressionAttributeValues: {
      ...expressionAttributeValues,
      ':tenantId': tenantId,
    },
    UpdateExpression: updateExpression,
    ReturnValues: 'ALL_NEW',
  })

  const result = await ddbDocClient.send(command)
  return result.Attributes as Record<string, any>
}

/**
 * Class-based Lambda handler using Powertools decorators.
 */
class Lambda implements LambdaInterface {
  /**
   * Main Lambda handler with basic routing.
   * The decorator will capture tracing information around the Lambda handler.
   */
  @tracer.captureLambdaHandler()
  public async handler(
    event: APIGatewayProxyEventV2,
    _context: Context
  ): Promise<APIGatewayProxyResultV2> {
    logger.debug('Event received', { event })
    const httpMethod = event.requestContext.http.method
    const path = event.rawPath
    const pathParameters = event.pathParameters

    try {
      // POST /tenants - Create a new tenant
      if (httpMethod === 'POST' && path === '/tenants') {
        return await this.createTenant(event)
      }

      // GET /tenants - List all tenants
      if (httpMethod === 'GET' && path === '/tenants') {
        return await this.getTenants(event)
      }

      // GET /tenants/{tenantId} - Get a single tenant by id
      if (
        httpMethod === 'GET' &&
        pathParameters &&
        path.startsWith('/tenants/')
      ) {
        const tenantId = pathParameters.tenantId
        if (!tenantId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing tenantId in path' }),
          }
        }
        return await this.getTenant(tenantId)
      }

      // PUT /tenants/{tenantId} - Update tenant
      if (
        httpMethod === 'PUT' &&
        pathParameters &&
        path.startsWith('/tenants/')
      ) {
        const tenantId = pathParameters.tenantId
        if (!tenantId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing tenantId in path' }),
          }
        }
        return await this.updateTenantHandler(tenantId, event)
      }

      // DELETE /tenants/{tenantId} - Mark tenant as inactive
      if (
        httpMethod === 'DELETE' &&
        pathParameters &&
        path.startsWith('/tenants/')
      ) {
        const tenantId = pathParameters.tenantId
        if (!tenantId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing tenantId in path' }),
          }
        }
        return await this.deleteTenantHandler(tenantId)
      }

      // If no route matches, return 404.
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Route not found' }),
      }
    } catch (error) {
      logger.error('Unhandled error', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      }
    }
  }

  private async createTenant(
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyResultV2> {
    logger.info('Request received to create new tenant')
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
      }
    }
    const inputDetails = JSON.parse(event.body)
    inputDetails.tenantId = randomUUID()
    inputDetails.active = true

    try {
      const command = new PutCommand({
        TableName: TENANT_DETAILS_TABLE,
        Item: inputDetails,
      })
      const response = await ddbDocClient.send(command)
      logger.info('PutItem response', { response })
      return {
        statusCode: 201,
        body: JSON.stringify({ data: inputDetails }),
      }
    } catch (error) {
      logger.error('Error creating tenant', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Unknown error during processing!' }),
      }
    }
  }

  private async getTenants(
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyResultV2> {
    logger.info('Request received to get all tenants')
    // Default limit is 10
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 10
    const nextToken = event.queryStringParameters?.next_token

    const params: any = { TableName: TENANT_DETAILS_TABLE, Limit: limit }
    if (nextToken) {
      params.ExclusiveStartKey = { tenantId: nextToken }
    }

    try {
      const command = new ScanCommand(params)
      const response = await ddbDocClient.send(command)
      const tenants = response.Items
      const result: any = { data: tenants }

      if (response.LastEvaluatedKey && response.LastEvaluatedKey.tenantId) {
        result.next_token = response.LastEvaluatedKey.tenantId
      }
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      }
    } catch (error) {
      logger.error('Error scanning tenants', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Unknown error during processing!' }),
      }
    }
  }

  private async getTenant(tenantId: string): Promise<APIGatewayProxyResultV2> {
    logger.info(`Request received to get a tenant: ${tenantId}`)
    try {
      const command = new GetCommand({
        TableName: TENANT_DETAILS_TABLE,
        Key: { tenantId },
      })
      const response = await ddbDocClient.send(command)
      if (!response.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            message: `Tenant not found for id ${tenantId}`,
          }),
        }
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ data: response.Item }),
      }
    } catch (error) {
      logger.error('Error getting tenant', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Unknown error during processing!' }),
      }
    }
  }

  private async updateTenantHandler(
    tenantId: string,
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyResultV2> {
    logger.info('Request received to update a tenant')
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
      }
    }
    const inputDetails = JSON.parse(event.body)
    try {
      const updatedTenant = await updateTenant(tenantId, inputDetails)
      return {
        statusCode: 200,
        body: JSON.stringify({ data: updatedTenant }),
      }
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        logger.info(`Tenant ${tenantId} not found for update`)
        return {
          statusCode: 404,
          body: JSON.stringify({ message: `Tenant ${tenantId} not found.` }),
        }
      }
      logger.error('Error updating tenant', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Unknown error during processing!' }),
      }
    }
  }

  private async deleteTenantHandler(
    tenantId: string
  ): Promise<APIGatewayProxyResultV2> {
    logger.info('Request received to delete a tenant')
    try {
      // Mark tenant as inactive
      const updatedTenant = await updateTenant(tenantId, {
        active: false,
      })
      return {
        statusCode: 200,
        body: JSON.stringify({ data: updatedTenant }),
      }
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        logger.info(`Tenant ${tenantId} not found for deletion`)
        return {
          statusCode: 404,
          body: JSON.stringify({ message: `Tenant ${tenantId} not found.` }),
        }
      }
      logger.error('Error deleting tenant', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Unknown error during processing!' }),
      }
    }
  }
}

// Export the bound handler method to preserve the class instance.
const lambdaInstance = new Lambda()
export const handler = lambdaInstance.handler.bind(lambdaInstance)

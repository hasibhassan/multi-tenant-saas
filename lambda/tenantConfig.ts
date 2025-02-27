import { Logger } from '@aws-lambda-powertools/logger'
import { Tracer } from '@aws-lambda-powertools/tracer'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda'

// Initialize Powertools
const tracer = new Tracer({ serviceName: 'tenant-config-service' })
const logger = new Logger({ serviceName: 'tenant-config-service' })

// Create AWS SDK v3 DynamoDB DocumentClient
const ddbClient = new DynamoDBClient({})
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)

// CORS headers for responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '300',
}

// Environment variables
const tenantDetailsTable = process.env.TENANT_DETAILS_TABLE!
const tenantConfigIndexName = process.env.TENANT_CONFIG_INDEX_NAME!
const tenantNameColumn = process.env.TENANT_NAME_COLUMN!
const tenantConfigColumn = process.env.TENANT_CONFIG_COLUMN!

class Lambda {
  /**
   * The handler method is decorated with Powertools Tracer.
   * The decorator will capture tracing information around the Lambda handler
   */
  @tracer.captureLambdaHandler()
  public async handler(
    event: APIGatewayProxyEventV2,
    context: Context
  ): Promise<APIGatewayProxyResultV2> {
    logger.debug('Received event', { event })

    try {
      let responseData: { tenantConfig: any; status: number }

      // If using a resource path like `${tenantConfigPath}/{tenantName}` make sure to use tenantName
      if (event.pathParameters && event.pathParameters.tenantName) {
        const tenantName = event.pathParameters.tenantName
        logger.info('Received tenant name via path parameter', { tenantName })
        if (!tenantName) {
          throw { statusCode: 400, message: 'Tenant name not found in path!' }
        }

        responseData = await this.getTenantConfigForTenantName(tenantName)
      } else {
        // Try query string parameters
        const tenantId = event.queryStringParameters?.tenantId
        logger.info('Received tenant id via query parameter', { tenantId })
        if (tenantId) {
          responseData = await this.getTenantConfigForTenantId(tenantId)
        } else {
          // Fallback to tenantName from query string or from the Origin header
          let tenantName = event.queryStringParameters?.tenantName
          if (!tenantName) {
            logger.info(
              'No tenantName query parameter found. Looking at headers.'
            )

            const originHeader = event.headers?.Origin || event.headers?.origin
            logger.info('Origin header', { originHeader })
            if (!originHeader) {
              throw { statusCode: 400, message: 'Origin header missing!' }
            }

            const parts = originHeader.split('://')
            if (parts.length < 2) {
              throw { statusCode: 400, message: 'Unable to parse tenant name!' }
            }

            const hostname = parts[1]
            tenantName = hostname.split('.')[0]
            if (!tenantName) {
              throw { statusCode: 400, message: 'Unable to parse tenant name!' }
            }
            logger.info('Tenant name parsed from hostname', { tenantName })
          }

          responseData = await this.getTenantConfigForTenantName(tenantName)
        }
      }

      return {
        statusCode: responseData.status,
        headers: CORS_HEADERS,
        body: JSON.stringify(responseData.tenantConfig),
      }
    } catch (error: any) {
      logger.error('Error processing request', { error })
      const statusCode = error.statusCode || 500
      const message = error.message || 'Internal Server Error'
      return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message }),
      }
    }
  }

  private async getTenantConfigForTenantName(
    name: string
  ): Promise<{ tenantConfig: any; status: number }> {
    try {
      const tenantConfig = await this.getTenantConfigByName(name)
      logger.info('Tenant config retrieved', { tenantConfig })
      if (!tenantConfig) {
        logger.error(`No tenant details found for ${name}`)
        throw {
          statusCode: 404,
          message: `No tenant details found for ${name}`,
        }
      }

      return { tenantConfig, status: 200 }
    } catch (error: any) {
      logger.error('Error in getTenantConfigForTenantName', { error })
      if (error.statusCode) throw error

      throw { statusCode: 500, message: 'Unknown error during processing!' }
    }
  }

  private async getTenantConfigByName(name: string): Promise<any | null> {
    const params = {
      TableName: tenantDetailsTable,
      IndexName: tenantConfigIndexName,
      KeyConditionExpression: `${tenantNameColumn} = :name`,
      ExpressionAttributeValues: {
        ':name': name,
      },
    }

    try {
      const response = await ddbDocClient.send(new QueryCommand(params))
      if (!response.Items || response.Items.length < 1) {
        return null
      }

      const tenantConfig = response.Items[0]
      return tenantConfig[tenantConfigColumn] ?? null
    } catch (error) {
      logger.error('Error querying tenant config by name', { error })

      throw error
    }
  }

  private async getTenantConfigForTenantId(
    id: string
  ): Promise<{ tenantConfig: any; status: number }> {
    try {
      const tenantConfig = await this.getTenantConfigById(id)
      logger.info('Tenant config retrieved', { tenantConfig })
      if (!tenantConfig) {
        logger.error(`No tenant details found for ${id}`)
        throw { statusCode: 404, message: `No tenant details found for ${id}` }
      }

      return { tenantConfig, status: 200 }
    } catch (error: any) {
      logger.error('Error in getTenantConfigForTenantId', { error })
      if (error.statusCode) throw error

      throw { statusCode: 500, message: 'Unknown error during processing!' }
    }
  }

  private async getTenantConfigById(id: string): Promise<any | null> {
    logger.info('Getting tenant config by id', { id })
    const params = {
      TableName: tenantDetailsTable,
      Key: { tenantId: id },
    }

    try {
      const response = await ddbDocClient.send(new GetCommand(params))
      if (!response.Item) {
        return null
      }

      const tenantConfig = response.Item
      return tenantConfig[tenantConfigColumn] ?? null
    } catch (error) {
      logger.error('Error getting tenant config by id', { error })
      throw error
    }
  }
}

// Create an instance of the Lambda class and bind the handler method
const lambdaInstance = new Lambda()
export const handler = lambdaInstance.handler.bind(lambdaInstance)

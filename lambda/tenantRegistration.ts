import { Sha256 } from '@aws-crypto/sha256-js'
import type { LambdaInterface } from '@aws-lambda-powertools/commons/types'
import { Logger } from '@aws-lambda-powertools/logger'
import { Tracer } from '@aws-lambda-powertools/tracer'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda'
import { randomUUID } from 'crypto'

/**
 * Initialization and Environment
 */
const tracer = new Tracer({
  serviceName: process.env.SERVICE_NAME || 'tenantRegistrationService',
})
const logger = new Logger()

const TENANT_REGISTRATION_TABLE_NAME =
  process.env.TENANT_REGISTRATION_TABLE_NAME!
if (!TENANT_REGISTRATION_TABLE_NAME) {
  throw new Error('TENANT_REGISTRATION_TABLE_NAME is not defined')
}

const tenantApiUrl = process.env.TENANT_API_URL!
if (!tenantApiUrl) {
  throw new Error('TENANT_API_URL is not defined')
}

const eventBusName = process.env.EVENTBUS_NAME!
const eventSource = process.env.EVENT_SOURCE!
const onboardingDetailType = process.env.ONBOARDING_DETAIL_TYPE!
const offboardingDetailType = process.env.OFFBOARDING_DETAIL_TYPE!
const awsRegion = process.env.AWS_REGION!

const ddbClient = new DynamoDBClient({ region: awsRegion })
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)

const eventBridgeClient = new EventBridgeClient({ region: awsRegion })

/**
 * Helper: Signed HTTP Request using AWS SDK v3’s SignatureV4 and built‑in fetch.
 *
 * This helper constructs a HttpRequest, signs it, and then converts it into
 * a fetch call
 */
async function signedRequest(method: string, url: string, data?: any) {
  const urlObj = new URL(url)
  const body = data ? JSON.stringify(data) : undefined

  // Build a HttpRequest from @aws-sdk/protocol-http.
  const requestToSign = new HttpRequest({
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: Number(urlObj.port), // Expects a number
    method,
    path: urlObj.pathname + urlObj.search,
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  // Create a SignatureV4 signer.
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: awsRegion,
    service: 'execute-api',
    sha256: Sha256,
  })

  // Sign the request.
  const signedRequest = await signer.sign(requestToSign)

  // Convert the signed request into fetch options.
  const fetchOptions: RequestInit = {
    method: signedRequest.method,
    headers: signedRequest.headers,
    body: signedRequest.body,
  }

  // Execute the request using the built-in fetch.
  const response = await fetch(url, fetchOptions)
  const responseBody = await response.text()
  let parsedData
  try {
    parsedData = JSON.parse(responseBody)
  } catch {
    parsedData = responseBody
  }

  return {
    status: response.status,
    data: parsedData,
  }
}

/**
 * Helper: Update Tenant Registration in DynamoDB.
 */
async function updateTenantRegistrationDDB(
  tenantRegistrationId: string,
  updateData: Record<string, any>
) {
  const updateExpression =
    'SET ' +
    Object.keys(updateData)
      .map((k) => `#${k} = :${k}`)
      .join(', ')
  const expressionAttributeNames = Object.keys(updateData).reduce((acc, k) => {
    acc[`#${k}`] = k
    return acc
  }, {} as Record<string, string>)
  const expressionAttributeValues = Object.keys(updateData).reduce((acc, k) => {
    acc[`:${k}`] = updateData[k]
    return acc
  }, {} as Record<string, any>)

  const command = new UpdateCommand({
    TableName: TENANT_REGISTRATION_TABLE_NAME,
    Key: { tenantRegistrationId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ConditionExpression: 'attribute_exists(tenantRegistrationId)',
    ReturnValues: 'ALL_NEW',
  })

  const response = await ddbDocClient.send(command)
  return response.Attributes
}

/**
 * Helper: Create a Control Plane Event on EventBridge.
 */
async function createControlPlaneEvent(
  eventDetails: string,
  detailType: string
) {
  const command = new PutEventsCommand({
    Entries: [
      {
        EventBusName: eventBusName,
        Source: eventSource,
        DetailType: detailType,
        Detail: eventDetails,
      },
    ],
  })
  const response = await eventBridgeClient.send(command)
  logger.info('EventBridge putEvents response', { response })
}

/**
 * Lambda Handler Class
 */
class Lambda implements LambdaInterface {
  /**
   * Main handler method.
   */
  @tracer.captureLambdaHandler()
  public async handler(
    event: APIGatewayProxyEventV2,
    _context: Context
  ): Promise<APIGatewayProxyResultV2> {
    logger.debug('Event received', { event })
    const httpMethod = event.requestContext.http.method
    const rawPath = event.rawPath
    const pathParameters = event.pathParameters || {}
    const queryParams = event.queryStringParameters || {}

    try {
      // You can use something like middy here instead
      if (httpMethod === 'POST' && rawPath === '/tenant-registrations') {
        return await this.createTenantRegistration(event)
      }

      if (
        httpMethod === 'GET' &&
        rawPath.startsWith('/tenant-registrations/') &&
        pathParameters.tenant_registration_id
      ) {
        return await this.getTenantRegistration(
          pathParameters.tenant_registration_id
        )
      }

      if (httpMethod === 'GET' && rawPath === '/tenant-registrations') {
        return await this.listTenantRegistrations(queryParams)
      }

      if (
        httpMethod === 'PATCH' &&
        rawPath.startsWith('/tenant-registrations/') &&
        pathParameters.tenant_registration_id
      ) {
        return await this.updateTenantRegistration(
          pathParameters.tenant_registration_id,
          event
        )
      }

      if (
        httpMethod === 'DELETE' &&
        rawPath.startsWith('/tenant-registrations/') &&
        pathParameters.tenant_registration_id
      ) {
        return await this.deleteTenantRegistration(
          pathParameters.tenant_registration_id
        )
      }

      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Route not found' }),
      }
    } catch (error: any) {
      logger.error('Unhandled error', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      }
    }
  }

  /**
   * POST /tenant-registrations
   */
  private async createTenantRegistration(
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyResultV2> {
    logger.info('Creating tenant registration')
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
      }
    }

    const jsonBody = JSON.parse(event.body)
    const tenantRegistrationId = randomUUID()
    const tenantData = jsonBody.tenantData || {}
    const tenantRegistrationData = jsonBody.tenantRegistrationData || {}

    // Build tenant registration item
    const tenantRegistrationItem = {
      tenantRegistrationId,
      active: true,
      ...tenantRegistrationData,
    }

    try {
      const putCommand = new PutCommand({
        TableName: TENANT_REGISTRATION_TABLE_NAME,
        Item: tenantRegistrationItem,
        ConditionExpression: 'attribute_not_exists(tenantRegistrationId)',
      })
      await ddbDocClient.send(putCommand)
    } catch (error: any) {
      logger.error('Error creating tenant registration', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error creating tenant registration' }),
      }
    }

    // Call tenant API to create a tenant.
    try {
      const tenantCreateUrl = `${tenantApiUrl.replace(/\/$/, '')}/tenants`
      const response = await signedRequest('POST', tenantCreateUrl, tenantData)
      if (response.status !== 201) {
        throw new Error('Failed to create tenant')
      }
      const tenantId = response.data.data.tenantId

      // Update the tenant registration with the new tenantId.
      await updateTenantRegistrationDDB(tenantRegistrationId, { tenantId })

      // Publish a control plane event with onboarding details.
      const eventDetail = JSON.stringify({
        ...tenantRegistrationData,
        ...tenantData,
        tenantId,
        tenantRegistrationId,
      })
      await createControlPlaneEvent(eventDetail, onboardingDetailType)

      return {
        statusCode: 201,
        body: JSON.stringify({
          data: {
            tenantRegistrationId,
            tenantId,
            message: 'Tenant registration initiated',
          },
        }),
      }
    } catch (error: any) {
      logger.error('Error calling tenant API', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to create tenant' }),
      }
    }
  }

  /**
   * GET /tenant-registrations/{tenant_registration_id}
   */
  private async getTenantRegistration(
    tenantRegistrationId: string
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const command = new GetCommand({
        TableName: TENANT_REGISTRATION_TABLE_NAME,
        Key: { tenantRegistrationId },
      })
      const response = await ddbDocClient.send(command)
      if (!response.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            message: `Tenant registration not found for id ${tenantRegistrationId}`,
          }),
        }
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ data: response.Item }),
      }
    } catch (error: any) {
      logger.error('Error retrieving tenant registration', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error retrieving tenant registration',
        }),
      }
    }
  }

  /**
   * GET /tenant-registrations (list)
   */
  private async listTenantRegistrations(
    queryParams: Record<string, string | undefined> // Ensure to safely extract values here
  ): Promise<APIGatewayProxyResultV2> {
    logger.info('Listing tenant registrations')
    // Default to "10" if queryParams.limit is undefined
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 10
    const nextToken = queryParams.next_token
    const params: any = {
      TableName: TENANT_REGISTRATION_TABLE_NAME,
      Limit: limit,
    }
    if (nextToken) {
      params.ExclusiveStartKey = { tenantRegistrationId: nextToken }
    }

    try {
      const command = new ScanCommand(params)
      const response = await ddbDocClient.send(command)
      const registrations = response.Items
      const result: any = { data: registrations }
      if (response.LastEvaluatedKey?.tenantRegistrationId) {
        result.next_token = response.LastEvaluatedKey.tenantRegistrationId
      }
      return { statusCode: 200, body: JSON.stringify(result) }
    } catch (error: any) {
      logger.error('Error listing tenant registrations', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error listing tenant registrations' }),
      }
    }
  }

  /**
   * PATCH /tenant-registrations/{tenant_registration_id}
   */
  private async updateTenantRegistration(
    tenantRegistrationId: string,
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyResultV2> {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
      }
    }
    const updateData = JSON.parse(event.body)
    try {
      let tenantId: string | undefined
      let tenantRegistration: any = {}
      let tenantResponse: any = {}

      if (Object.keys(updateData.tenantRegistrationData || {}).length === 0) {
        const getCmd = new GetCommand({
          TableName: TENANT_REGISTRATION_TABLE_NAME,
          Key: { tenantRegistrationId },
        })
        const regResponse = await ddbDocClient.send(getCmd)
        tenantRegistration = regResponse.Item
        tenantId = tenantRegistration?.tenantId
        if (!tenantId) {
          return {
            statusCode: 404,
            body: JSON.stringify({
              message: 'Tenant ID not found for this registration',
            }),
          }
        }
      } else {
        const updated = await updateTenantRegistrationDDB(
          tenantRegistrationId,
          updateData.tenantRegistrationData
        )
        tenantRegistration = updated
        tenantId = updated?.tenantId
      }

      if (
        updateData.tenantData &&
        Object.keys(updateData.tenantData).length > 0
      ) {
        const tenantUpdateUrl = `${tenantApiUrl.replace(
          /\/$/,
          ''
        )}/tenants/${tenantId}`
        const response = await signedRequest(
          'PUT',
          tenantUpdateUrl,
          updateData.tenantData
        )
        if (response.status !== 200) {
          logger.error('Error updating tenant', { response: response.data })
          return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to update tenant' }),
          }
        }
        tenantResponse = response.data
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          data: {
            tenantRegistration,
            tenant: tenantResponse.data,
            message: 'Tenant registration updated successfully',
          },
        }),
      }
    } catch (error: any) {
      logger.error('Error updating tenant registration', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error updating tenant registration' }),
      }
    }
  }

  /**
   * DELETE /tenant-registrations/{tenant_registration_id}
   */
  private async deleteTenantRegistration(
    tenantRegistrationId: string
  ): Promise<APIGatewayProxyResultV2> {
    try {
      const getCmd = new GetCommand({
        TableName: TENANT_REGISTRATION_TABLE_NAME,
        Key: { tenantRegistrationId },
      })
      const response = await ddbDocClient.send(getCmd)
      if (!response.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            message: `Tenant registration not found for id ${tenantRegistrationId}`,
          }),
        }
      }
      const tenantId = response.Item.tenantId
      if (!tenantId) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            message: 'Tenant ID not found for this registration',
          }),
        }
      }

      // Call tenant API to delete the tenant.
      const tenantDeleteUrl = `${tenantApiUrl.replace(
        /\/$/,
        ''
      )}/tenants/${tenantId}`
      const deleteResponse = await signedRequest('DELETE', tenantDeleteUrl)
      if (deleteResponse.status !== 200) {
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Failed to delete tenant' }),
        }
      }

      // Mark the registration as inactive.
      await updateTenantRegistrationDDB(tenantRegistrationId, {
        active: false,
      })

      // Publish an offboarding control plane event.
      const eventDetail = JSON.stringify({
        ...deleteResponse.data.data,
        ...response.Item,
      })
      await createControlPlaneEvent(eventDetail, offboardingDetailType)

      return {
        statusCode: 200,
        body: JSON.stringify({
          data: { message: 'Tenant registration deletion initiated' },
        }),
      }
    } catch (error: any) {
      logger.error('Error deleting tenant registration', { error })
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error deleting tenant registration' }),
      }
    }
  }
}

// Export the bound handler.
const lambdaInstance = new Lambda()
export const handler = lambdaInstance.handler.bind(lambdaInstance)

import { Sha256 } from '@aws-crypto/sha256-js'
import { Logger } from '@aws-lambda-powertools/logger'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import { Context } from 'aws-lambda'

// Initialize Lambda Powertools logger
const logger = new Logger({ serviceName: 'TenantRegistrationStatusUpdater' })

// Retrieve the HTTP API endpoint URL from environment variables.
const TENANT_API_URL = process.env.TENANT_API_URL
const TENANT_REGISTRATION_PATH = process.env.TENANT_REGISTRATION_PATH

// The region is typically provided in the Lambda environment.
const REGION = process.env.AWS_REGION || 'us-east-1'

interface TenantRegistrationEvent {
  tenantRegistrationId: string
  jobOutput?: any
}

/**
 * Lambda handler that calls the `tenant-registration` HTTP API endpoint (protected by IAM auth) to update tenant registration status.
 */
export const handler = async (
  event: TenantRegistrationEvent,
  context: Context
): Promise<void> => {
  logger.info('Received event', { event, requestId: context.awsRequestId })

  // Validate required fields
  if (!event.tenantRegistrationId) {
    const errorMsg = 'Missing tenantRegistrationId in event'
    logger.error(errorMsg, JSON.stringify(event))
    throw new Error(errorMsg)
  }

  // Build the payload for the HTTP API call
  const payload = {
    tenantRegistrationId: event.tenantRegistrationId,
    jobOutput: event.jobOutput || {},
    timestamp: new Date().toISOString(),
  }

  if (!TENANT_API_URL) {
    const errorMsg = 'TENANT_API_URL is not defined in environment variables'
    logger.error(errorMsg)
    throw new Error(errorMsg)
  }

  // Parse the API URL to extract hostname, path, etc.
  const endpoint = `${TENANT_API_URL}${TENANT_REGISTRATION_PATH}${event.tenantRegistrationId}`
  const url = new URL(endpoint)

  // Create the HTTP request object for signing
  const requestToSign = new HttpRequest({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port ? parseInt(url.port) : undefined,
    method: 'PATCH',
    path: url.pathname, // use the path from the URL
    headers: {
      'Content-Type': 'application/json',
      host: url.host, // required for SigV4 signing
    },
    body: JSON.stringify(payload),
  })

  try {
    // Sign the HTTP request using SigV4
    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region: REGION,
      service: 'execute-api',
      sha256: Sha256,
    })

    const signedRequest = await signer.sign(requestToSign)

    // Convert signedRequest.headers into the format expected by fetch (plain object)
    const signedHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(signedRequest.headers)) {
      signedHeaders[key] = value as string
    }

    // Use the global fetch (available in Node.js 18+) to call the API
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: signedHeaders,
      body: signedRequest.body,
    })

    if (!response.ok) {
      const responseBody = await response.text()
      const errorMsg = `HTTP API call failed with status ${response.status}`
      logger.error(errorMsg, { response: responseBody })
      throw new Error(errorMsg)
    }

    logger.info('HTTP API call succeeded', { status: response.status })
  } catch (error) {
    logger.error('HTTP API call failed', { error })
    throw error
  }
}

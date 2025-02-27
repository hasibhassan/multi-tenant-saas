import { Logger } from '@aws-lambda-powertools/logger'
import { Tracer } from '@aws-lambda-powertools/tracer'
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda'

// Initialize Powertools logger and tracer.
const logger = new Logger({ serviceName: 'user-management-service' })
const tracer = new Tracer()

// Identity Provider details from environment.
const idpDetails = {
  idp: {
    userPoolId: process.env.USER_POOL_ID as string,
  },
}

/**
 * Service class wrapping Cognito operations.
 */
class CognitoUserManagementService {
  private client: CognitoIdentityProviderClient

  constructor() {
    this.client = new CognitoIdentityProviderClient({})
  }

  @tracer.captureMethod()
  async createUser(event: {
    userName: string
    userRole: string
    email: string
    idpDetails: { idp: { userPoolId: string } }
  }): Promise<any> {
    try {
      const command = new AdminCreateUserCommand({
        Username: event.userName,
        UserPoolId: event.idpDetails.idp.userPoolId,
        ForceAliasCreation: true,
        UserAttributes: [
          { Name: 'email', Value: event.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:userRole', Value: event.userRole },
        ],
      })
      const response = await this.client.send(command)
      logger.info(`create_user_response: ${JSON.stringify(response)}`)
      return response
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        return null
      }
      throw error
    }
  }

  @tracer.captureMethod()
  async getUsers(event: {
    idpDetails: { idp: { userPoolId: string } }
    limit: number
    next_token?: string
  }): Promise<{ users: any[]; nextToken?: string }> {
    const params: any = {
      UserPoolId: event.idpDetails.idp.userPoolId,
      Limit: event.limit,
    }

    if (event.next_token) {
      params.PaginationToken = event.next_token
    }

    const command = new ListUsersCommand(params)
    const response = await this.client.send(command)

    const users = (response.Users || []).map((user) => {
      let userRole: string | undefined
      let email: string | undefined

      if (user.Attributes) {
        for (const attr of user.Attributes) {
          if (attr.Name === 'custom:userRole') {
            userRole = attr.Value
          }
          if (attr.Name === 'email') {
            email = attr.Value
          }
        }
      }

      return {
        userName: user.Username,
        userRole,
        email,
        enabled: user.Enabled,
        created: user.UserCreateDate,
        modified: user.UserLastModifiedDate,
        status: user.UserStatus,
      }
    })

    return { users, nextToken: response.PaginationToken }
  }

  @tracer.captureMethod()
  async getUser(event: {
    idpDetails: { idp: { userPoolId: string } }
    userName: string
  }): Promise<any | null> {
    try {
      let userRole: string | undefined
      let email: string | undefined

      const command = new AdminGetUserCommand({
        UserPoolId: event.idpDetails.idp.userPoolId,
        Username: event.userName,
      })
      const response = await this.client.send(command)

      if (response.UserAttributes) {
        for (const attr of response.UserAttributes) {
          if (attr.Name === 'custom:userRole') {
            userRole = attr.Value
          }
          if (attr.Name === 'email') {
            email = attr.Value
          }
        }
      }

      return {
        userName: response.Username,
        enabled: response.Enabled,
        created: response.UserCreateDate,
        modified: response.UserLastModifiedDate,
        status: response.UserStatus,
        userRole,
        email,
      }
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        return null
      }
      throw error
    }
  }

  @tracer.captureMethod()
  async updateUser(event: {
    idpDetails: { idp: { userPoolId: string } }
    userName: string
    email?: string
    userRole?: string
  }): Promise<any> {
    const attributes = []
    if (event.email) {
      attributes.push({ Name: 'email', Value: event.email })
    }
    if (event.userRole) {
      attributes.push({ Name: 'custom:userRole', Value: event.userRole })
    }
    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: event.idpDetails.idp.userPoolId,
      Username: event.userName,
      UserAttributes: attributes,
    })
    const response = await this.client.send(command)
    return response
  }

  @tracer.captureMethod()
  async disableUser(event: {
    idpDetails: { idp: { userPoolId: string } }
    userName: string
  }): Promise<any> {
    const command = new AdminDisableUserCommand({
      UserPoolId: event.idpDetails.idp.userPoolId,
      Username: event.userName,
    })
    const response = await this.client.send(command)
    return response
  }

  @tracer.captureMethod()
  async enableUser(event: {
    idpDetails: { idp: { userPoolId: string } }
    userName: string
  }): Promise<any> {
    const command = new AdminEnableUserCommand({
      UserPoolId: event.idpDetails.idp.userPoolId,
      Username: event.userName,
    })
    const response = await this.client.send(command)
    return response
  }

  @tracer.captureMethod()
  async deleteUser(event: {
    idpDetails: { idp: { userPoolId: string } }
    userName: string
  }): Promise<any> {
    try {
      const command = new AdminDeleteUserCommand({
        UserPoolId: event.idpDetails.idp.userPoolId,
        Username: event.userName,
      })
      const response = await this.client.send(command)
      return response
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        return null
      }
      throw error
    }
  }
}

// Instantiate the service.
const userService = new CognitoUserManagementService()

/**
 * A basic router to handle HTTP API routes.
 */
class LambdaHandler {
  @tracer.captureLambdaHandler()
  async handler(
    event: APIGatewayProxyEventV2,
    _context: Context
  ): Promise<APIGatewayProxyResultV2> {
    logger.debug('Event: ', JSON.stringify(event))

    try {
      const method = event.requestContext.http.method
      // Using event.rawPath from HTTP API v2.0
      const path = event.rawPath
      const segments = path.split('/').filter((s) => s !== '')

      let responseBody: any
      let statusCode = 200

      // POST /users → Create a new user.
      if (
        method === 'POST' &&
        segments[0] === 'users' &&
        segments.length === 1
      ) {
        if (!event.body) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing request body' }),
          }
        }
        const { userName, userRole, email } = JSON.parse(event.body)
        const result = await userService.createUser({
          userName,
          userRole,
          email,
          idpDetails,
        })
        logger.info(result)
        if (!result) {
          return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to create user' }),
          }
        }
        statusCode = 201
        responseBody = { data: { userName } }

        // GET /users or GET /users/{userId}
      } else if (method === 'GET' && segments[0] === 'users') {
        // GET /users → list users
        if (segments.length === 1) {
          const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit)
            : 10
          const next_token = event.queryStringParameters?.next_token
          const { users, nextToken } = await userService.getUsers({
            idpDetails,
            limit,
            next_token,
          })
          logger.info(JSON.stringify(users))
          responseBody = { data: users }
          if (nextToken) {
            responseBody.next_token = nextToken
          }
          // GET /users/{userId} → get a single user
        } else if (segments.length === 2) {
          const userId = segments[1]
          const user = await userService.getUser({
            idpDetails,
            userName: userId,
          })
          if (user) {
            logger.info(JSON.stringify(user))
            responseBody = { data: user }
          } else {
            return {
              statusCode: 404,
              body: JSON.stringify({ message: `User ${userId} not found` }),
            }
          }
        } else {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Not Found' }),
          }
        }

        // PUT /users/{userId} → Update user OR PUT /users/{userId}/enable → Enable user.
      } else if (method === 'PUT' && segments[0] === 'users') {
        // PUT /users/{userId} for updating email/userRole.
        if (segments.length === 2) {
          const userId = segments[1]
          if (!event.body) {
            return {
              statusCode: 400,
              body: JSON.stringify({ message: 'Missing request body' }),
            }
          }
          const { email, userRole } = JSON.parse(event.body)
          const result = await userService.updateUser({
            idpDetails,
            userName: userId,
            email,
            userRole,
          })
          logger.info(result)
          responseBody = { message: 'User updated' }

          // PUT /users/{userId}/enable → Enable user.
        } else if (segments.length === 3 && segments[2] === 'enable') {
          const userId = segments[1]
          const result = await userService.enableUser({
            idpDetails,
            userName: userId,
          })
          logger.info(result)
          responseBody = { message: 'User enabled' }
        } else {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Not Found' }),
          }
        }

        // DELETE /users/{userId}/disable → Disable user OR DELETE /users/{userId} → Delete user.
      } else if (method === 'DELETE' && segments[0] === 'users') {
        if (segments.length === 3 && segments[2] === 'disable') {
          const userId = segments[1]
          const result = await userService.disableUser({
            idpDetails,
            userName: userId,
          })
          logger.info(result)
          responseBody = { message: 'User disabled' }
        } else if (segments.length === 2) {
          const userId = segments[1]
          const result = await userService.deleteUser({
            idpDetails,
            userName: userId,
          })
          if (!result) {
            logger.info(`User ${userId} not found.`)
          } else {
            logger.info(result)
          }
          responseBody = { message: 'User deleted' }
        } else {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Not Found' }),
          }
        }
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Not Found' }),
        }
      }

      return {
        statusCode,
        body: JSON.stringify(responseBody),
        headers: { 'Content-Type': 'application/json' },
      }
    } catch (error) {
      logger.error(JSON.stringify(error))

      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal server error' }),
      }
    }
  }
}

const lambdaHandlerInstance = new LambdaHandler()
export const handler = lambdaHandlerInstance.handler.bind(lambdaHandlerInstance)

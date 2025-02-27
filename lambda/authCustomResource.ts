import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import { CloudFormationCustomResourceEvent, Context } from 'aws-lambda'

const cognitoClient = new CognitoIdentityProviderClient({})

export const handler = async (
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<void> => {
  console.log('Received event:', JSON.stringify(event))

  const { RequestType, ResourceProperties } = event
  const userName = ResourceProperties.Name as string
  const email = ResourceProperties.Email as string
  const userRole = ResourceProperties.Role as string
  const userPoolId = ResourceProperties.UserPoolId as string
  const physicalResourceId = (event as any).PhysicalResourceId || userName

  try {
    if (RequestType === 'Create' || RequestType === 'Update') {
      try {
        const command = new AdminCreateUserCommand({
          Username: userName,
          UserPoolId: userPoolId,
          ForceAliasCreation: true,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:userRole', Value: userRole },
          ],
        })

        await cognitoClient.send(command)
        console.log(`User "${userName}" created/updated successfully.`)
      } catch (error: any) {
        if (error.name === 'UsernameExistsException') {
          console.log(`User "${userName}" already exists. Attempting RESEND.`)

          try {
            const resendCommand = new AdminCreateUserCommand({
              Username: userName,
              UserPoolId: userPoolId,
              MessageAction: 'RESEND', // Resend activation
            })

            await cognitoClient.send(resendCommand)
            console.log(`Resent activation email for "${userName}".`)
          } catch (resendError: any) {
            console.error(
              `Failed to resend activation email: ${resendError.message}`
            )

            throw resendError // If resend fails, fail the entire request
          }
        } else {
          throw error // If it's another error, fail as usual
        }
      }

      // Send success response to CloudFormation
      return await sendResponse(event, context, 'SUCCESS', userName)
    }

    if (RequestType === 'Delete') {
      const usernameToDelete = physicalResourceId || userName

      try {
        const command = new AdminDeleteUserCommand({
          UserPoolId: userPoolId,
          Username: usernameToDelete,
        })
        await cognitoClient.send(command)
        console.log(`User "${usernameToDelete}" deleted successfully.`)
      } catch (error: any) {
        if (error.name === 'UserNotFoundException') {
          console.log(
            `User "${usernameToDelete}" does not exist, skipping deletion.`
          )
        } else {
          throw error // Re-throw other errors
        }
      }

      // Send success response for delete
      return await sendResponse(event, context, 'SUCCESS', usernameToDelete)
    }

    throw new Error(`Unsupported RequestType: ${RequestType}`)
  } catch (error: any) {
    console.error(`Error processing event: ${error.message}`, error)

    // Send failure response to CloudFormation
    await sendResponse(
      event,
      context,
      'FAILED',
      physicalResourceId || userName,
      {
        Error: error.message,
      }
    )
  }
}

/**
 * Sends a response back to CloudFormation using fetch()
 */
const sendResponse = async (
  event: CloudFormationCustomResourceEvent,
  context: Context,
  status: 'SUCCESS' | 'FAILED',
  physicalResourceId: string,
  responseData: object = {}
) => {
  const responseBody = JSON.stringify({
    Status: status,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  })

  console.log('Sending response to CloudFormation:', responseBody)

  await fetch(event.ResponseURL, {
    method: 'PUT',
    headers: { 'Content-Type': '' },
    body: responseBody,
  })
}

const config = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID as string,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID as string,
      // groups?: Record<string, UserGroupPrecedence>[];
      // loginWith?: {
      //     email?: boolean;
      //     oauth?: OAuthConfig;
      //     phone?: boolean;
      //     username?: boolean;
      // };
      // mfa?: {
      //     smsEnabled?: boolean;
      //     status?: CognitoUserPoolConfigMfaStatus;
      //     totpEnabled?: boolean;
      // };
      // passwordFormat?: {
      //     minLength?: number;
      //     requireLowercase?: boolean;
      //     requireNumbers?: boolean;
      //     requireSpecialCharacters?: boolean;
      //     requireUppercase?: boolean;
      // };
      // signUpVerificationMethod?: "link" | "code";
      // userAttributes?: Partial<Record<AuthStandardAttributeKey, {
      //     required: boolean;
      // }>>;
    },
  },
  API: {
    REST: {
      MyHTTPAPI: {
        endpoint: process.env.NEXT_PUBLIC_API_ENDPOINT as string,
        region: process.env.NEXT_PUBLIC_REGION,
      },
    },
  },
}

export default config

import { Amplify } from 'aws-amplify';

const region = process.env.NEXT_PUBLIC_AWS_REGION;
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
const identityPoolId = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

const configured = !bypassAuth && Boolean(region && userPoolId && userPoolClientId && identityPoolId && apiBaseUrl);

if (configured) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId as string,
        userPoolClientId: userPoolClientId as string,
        identityPoolId: identityPoolId as string,
        loginWith: {
          username: false,
          email: true,
          phone: false,
        },
      },
    },
    API: {
      REST: {
        PlanningTrackerApi: {
          endpoint: apiBaseUrl as string,
          region: region as string,
        },
      },
    },
  });
}

export const isAmplifyConfigured = configured;
export const isAuthBypassed = bypassAuth;

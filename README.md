# Multi-Tenant SaaS

## Available Scripts

### For the frontend

- Add a `.env` file with the following ouputted values from the ControlPlaneStack
```sh
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=
NEXT_PUBLIC_API_GATEWAY_ENDPOINT=https://[your-id].execute-api.us-east-1.amazonaws.com/
NEXT_PUBLIC_REGION=us-east-1
FRONTEND_DOMAIN=
```
```sh
cd frontend
npm i
```
* `npm run build`   builds the static output
* `npm run dev`   starts the dev server
* `npx serve out`    serves the static output


###  From project root:
Ensure local AWS CLI configured
* `npx cdk bootstrap`    Bootstraps CDK resources
* `npx cdk deploy ControlPlaneStack`    Deploys the Control Plane
* `npx cdk deploy FrontendStack`    Deploys the `/out` (static export) in the `/frontend` dir to CloudFront 
* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

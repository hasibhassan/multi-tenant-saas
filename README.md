<h1 align="center">
  Multi-Tenant SaaS
  <br>
</h1>

<p align="center">
  <a>
    <img src="https://img.shields.io/badge/License-Apache_2.0-yellowgreen.svg"
         alt="License"
         href="https://opensource.org/licenses/Apache-2.0">
  </a>
  <a href="https://d1ww2wzcm0dott.cloudfront.net/"><img src="https://img.shields.io/badge/Demo-online-brightgreen"></a>
</p>

This project is a demo/reference architecture for building serverless, multi-tenant SaaS applications on AWS using the [AWS Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/) in TypeScript. It demonstrates essential control plane functionalities including auth, user management, and tenant management.

The aim of this project is to showcase how a multi-tenant SaaS might be structured using AWS services and to act as a starting point or reference for developers looking to build multi-tenant serverless application. It is also meant to be extensible and provides some types to allow using other implementations of various services like auth or billing. Future plans include leveraging open standards like [OpenTelemetry](https://opentelemetry.io/) and [CloudEvents](https://cloudevents.io/) for even more extensibility. This is not a fully featured SaaS product, but a skeleton with enough scaffolding to demonstrate tenant onboarding, auth, billing, metering, and basic user flows.

The Next.js static site included here provides only a placeholder landing page, a basic dashboard, and simple auth integration. It does not fully implement tenant-aware UI features. Feel free to replace or extend it with your own frontend.

## Technologies Used

- AWS CDK (TypeScript)
- Core services for the control plane: AWS Lambda, Amazon API Gateway, Amazon DynamoDB, Amazon Cognito, Amazon EventBridge 
- Next.js (for the static frontend demo) with S3 + CloudFront

## Project Structure
```sh
.
├── bin/
│   └── multi-tenant-saas.ts   # Entry point for AWS CDK App
├── frontend/
│   ├── package.json           # Frontend dependencies (Next.js)
│   └── src/
│       └── app/
│           ├── page.tsx       # Landing page (using Next.js App Router)
│           └── ...            # Additional page routes
├── lambda/
│   └── ...                    # Lambda functions handlers
├── lib/
│   ├── auth/                  # Auth construct
│   ├── tenant-management/     # Tenant management constructs
│   ├── control-plane.ts       # Entry point of the control plane
│   └── ...                    # Additional constructs and AWS resources
└── README.md
```

## Architecture Diagram (High-Level)

![AWS architecture diagram](frontend/public/images/multi-tenant-saas-diagram.png)

## Architecture

The project is split into three main components:

1. **Control Plane**
    - **Authentication & User Management:** Uses AWS Cognito to manage system users and tenant users. You can add tenant-specific data (like a tenant ID) directly to the Cognito user record using custom attributes.
    - **Tenant Management:** Implements a unified tenant management solution for registration, onboarding and offboarding.
    - **API Endpoints:** Provides RESTful endpoints to handle tenant registrations and related operations.

2. **Application Plane (Minimal)**
    - In this demo, not much is implemented beyond placeholders. In a real SaaS, you would add your app logic here.

3. **Frontend**
    - **Next.js Static Website:** Demonstrates a basic SaaS UI with a landing page, sign up & login, and dashboard.
    - **Basic Authentication:** Implements simple auth to protect access to demo dashboard pages.

## Available Scripts

### Prerequisites and Setup

- [Node.js](https://nodejs.org/) (v18 or later)
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) (v2 recommended)

>[!NOTE] 
>[Bootstrapped CDK environment required](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html)

###  From project root:
* `npx cdk bootstrap`    Bootstraps CDK resources
* `npx cdk deploy ControlPlaneStack`    Deploys the Control Plane

>[!NOTE] 
> This will create or update your AWS resources, including:
> - Cognito User Pool and App Client
> - API Gateway HTTP API
> - DynamoDB tables for tenant/user records
> - Lambda functions orchestrating create/update/delete of tenants
> - EventBridge event bus

* `npx cdk deploy FrontendStack`    Deploys the `/out` (static export) in the `/frontend` dir to CloudFront 
* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

### For the frontend

- Add a `.env` file with the following ouputted values from the ControlPlaneStack
```sh
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=
NEXT_PUBLIC_API_GATEWAY_ENDPOINT=https://[your-id].execute-api.us-east-1.amazonaws.com/
NEXT_PUBLIC_REGION=us-east-1
FRONTEND_DOMAIN=
```

Instructions for the frontend are [here](frontend/README.md)

## License

This project is licensed under the **[Apache License Version 2.0](./LICENSE.txt)**, a permissive free open-source license.

Disclaimer: This reference architecture is provided as-is, without warranties, and is intended for educational or prototyping purposes. For production workloads, please review and adjust security, compliance, and operational considerations accordingly.
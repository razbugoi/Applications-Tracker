# AWS Infrastructure Inventory (Pre-Migration)

This document captures the current AWS resources before the Vercel + Supabase migration. It consolidates the configuration spread across `template.yaml`, Amplify hosting, and the provisioning scripts.

## Core Application Stack

| Component | AWS Service | Resource Name | Notes |
|-----------|-------------|---------------|-------|
| Frontend hosting | AWS Amplify Hosting | `main` app | Connected to the repository, builds Next.js frontend from `frontend/`. Uses Amplify-provided CloudFront distribution. |
| REST API gateway | API Gateway (HTTP API) | `PlanningTrackerApi` | Defined in `template.yaml` as `PlanningTrackerApi`. Authorised by Cognito User Pool unless `DisableApiAuth=true`. |
| Compute | AWS Lambda | `CreateApplicationFunction`, `ListApplicationsFunction`, `GetApplicationFunction`, `UpdateApplicationFunction`, `CreateIssueFunction`, `UpdateIssueFunction`, `ListIssuesFunction`, `CreateExtensionFunction`, `HealthFunction` | TypeScript handlers compiled to Node.js 20.x, live under `backend/src/handlers`. Deployed via AWS SAM. |
| Data store | DynamoDB | `ApplicationsTable` | Pay-per-request table with PK `PK`, SK `SK`, GSIs `GSI1` (status/submission) and `GSI2` (PP reference). Holds applications, issues, timeline events. |
| Document storage | Amazon S3 | `DocumentsBucket` | Stores supporting documents (letters, uploads). Access controlled by presigned URLs from Lambda. |
| Authentication | Amazon Cognito | `eu-west-2_Mp5QuBMEE` (User Pool) / Identity Pool | Configured for email sign-in. Frontend uses Amplify `aws-amplify` client for session handling. |
| Background jobs | EventBridge Scheduler + Lambda | (Planned) | Template contains placeholders for deadline reminder jobs (currently disabled). |

## Supporting Configuration

- **Infrastructure as Code**: `template.yaml` (AWS SAM) defines Lambda functions, IAM roles, API routes, DynamoDB table, and S3 bucket. Environment variables include `TABLE_NAME`, `DOCUMENT_BUCKET`, and optional `DYNAMODB_ENDPOINT` for local testing.
- **Amplify Build Pipeline**: `amplify.yml` builds the Next.js frontend (`npm install`, `npm run build`) and deploys static assets to Amplify hosting. Post-build step runs `npm run export` to generate static HTML.
- **Scripts**: `scripts/` directory contains utilities for Cognito user creation (`create-user.js`), data import/export (`import-applications.js`, `production-import.js`), and DynamoDB Local setup.

## Observability & Monitoring

- Lambda functions stream logs to **CloudWatch Logs** under `/aws/lambda/<FunctionName>`.
- API Gateway access logs are configured through SAM (`AccessLogSettings` placeholder pending enablement).
- DynamoDB table relies on on-demand capacity alarms (not yet provisioned).
- Amplify provides basic deployment logs; no dedicated performance monitoring beyond CloudWatch.

## Security Posture

- Cognito User Pool issues JWTs for API Gateway authorisation.
- IAM roles defined per Lambda with least-privilege access to `ApplicationsTable` and `DocumentsBucket`.
- DynamoDB encryption at rest enabled by default; S3 bucket enforces private ACL and SSE-S3.
- No customer-managed KMS keys or audit trails are currently configured.

## Data Backups

- No automated DynamoDB backups are currently configured. Manual exports achieved via `scripts/export-data.js`.
- S3 bucket relies on versioning disabled; backups handled manually as needed.

## Outstanding AWS Tasks (Pre-Migration)

- Evaluate CloudWatch alarms for API 5xx errors and DynamoDB throttles.
- Document AWS Budgets threshold for monitoring free-tier usage.
- Confirm EventBridge schedulers are disabled prior to migration cutover to avoid orphaned invocations.

This inventory forms the baseline for decommissioning once the production cutover to Vercel + Supabase is complete.

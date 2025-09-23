# Planning Application Tracker

Serverless web application for tracking planning applications from submission through determination. The project replaces the Excel workbook with a collaborative workflow backed by AWS free-tier services.

## Repository Layout
- `docs/` – architecture and data model references.
- `backend/` – AWS SAM serverless API (Lambda + API Gateway + DynamoDB).
- `frontend/` – Next.js dashboard hosted via Amplify Hosting.
- `template.yaml` – infrastructure as code for backend, Cognito, DynamoDB, and S3.

## Prerequisites
- Node.js 18+ and npm.
- AWS CLI configured with credentials that can deploy SAM stacks.
- AWS SAM CLI (`sam`).
- Optional: Docker (for `sam local` testing).

## Local Development
### 1. Backend
```bash
cd backend
npm install
sam build
sam deploy --guided
```
Take note of the API URL and Cognito identifiers exported by the stack.

For local iteration, use `sam-env.json` to point the Lambdas at DynamoDB Local (see the migration notes below).

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Create a `.env.local` with the backend outputs:
```
NEXT_PUBLIC_API_BASE_URL=https://xxxx.execute-api.eu-west-2.amazonaws.com/prod
NEXT_PUBLIC_AWS_REGION=eu-west-2
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-2_example
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=exampleclientid
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=eu-west-2:xxxx-xxxx
NEXT_PUBLIC_BYPASS_AUTH=false
```

Set `NEXT_PUBLIC_BYPASS_AUTH=true` when the frontend targets a locally running API that has auth disabled (see backend instructions below).

### Authentication
- `sam deploy` provisions a Cognito User Pool, User Pool client, and Identity Pool. The deployment outputs (`UserPoolId`, `UserPoolClientId`, and `IdentityPoolId`) map directly to the variables in `.env.local`.
- Create your first user via the AWS console or the CLI, for example:
  ```bash
  aws cognito-idp sign-up \
    --client-id <NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID> \
    --username you@example.com \
    --password 'ExamplePassword1!'
  ```
  Follow with `aws cognito-idp admin-confirm-sign-up` (or confirm via the email link) before attempting to sign in through the app.
- When running the backend with `DisableApiAuth=true`, set `NEXT_PUBLIC_BYPASS_AUTH=true` to hide the Amplify sign-in UI. Otherwise the frontend enforces Cognito authentication and exposes a “Sign out” control in the navigation bar.

## Deployment Workflow
1. Deploy backend stack with `sam deploy`. Stack provisions DynamoDB table, S3 bucket for documents, Cognito pools, and API Gateway routes linked to Lambda handlers.
2. Configure Amplify Hosting to watch your Git repository or deploy manually:
   ```bash
   npm run build
   npx amplify publish
   ```
   Ensure environment variables match `.env.local`.
3. Post-deployment, add initial Cognito users either via the AWS console or the CLI.

Navigate to `/issues` in the frontend to see a consolidated list of all recorded issues and jump straight to the affected application. Within any Live application you can now record multiple Extensions of Time; each entry is visible in the application detail view and the latest agreed date is reflected on the summary views. Use `/outcomes` for a portfolio-wide outcome summary and `/calendar` for key determination/EOT dates.

## Data Migration (Spreadsheet to DynamoDB)
- Use the importer under `scripts/` to pull rows from the legacy workbook.
  ```bash
  # 1. Start DynamoDB Local (one-time per session)
  docker run --rm --name dynamodb-local -p 8000:8000 amazon/dynamodb-local

  # 2. In a separate terminal build and launch the SAM API with env overrides
  sam build
  sam local start-api \
    -t .aws-sam/build/template.yaml \
    --env-vars sam-env.json \
    --parameter-overrides DisableApiAuth=true \
    --port 3001

  # 3. Import spreadsheet rows (dry-run first)
  cd scripts
  npm install # first run only
  npm run import:applications -- \
    --file ../master-applications-tracker/ApplicationsTrackerMaster.xlsm \
    --api http://localhost:3001 \
    --dry-run
  ```
  Remove `--dry-run` to persist to DynamoDB Local once the payload preview looks correct, and provide `--token <JWT>` when pointing at a deployed API secured by Cognito. When the API is running locally with `DisableApiAuth=true`, authentication is bypassed and no token is required. The importer currently ingests the `SubmittedApplications`, `LiveApplications`, and `DeterminedApplications` sheets and skips duplicates based on PP reference.
  Default planning-portal links are resolved from `config/council-portals.json` during import; edit this file to point to the correct search page for each authority. Links can also be overridden per application inside the UI.
- Maintain PP reference as the stable identifier between legacy data and the new system.

## Testing
- Add unit tests under `backend/tests` using Vitest (not yet scaffolded).
- Use `sam local start-api` with a local DynamoDB (e.g., DynamoDB Local in Docker) for offline testing.
- Frontend uses SWR for data fetching; add integration tests with Playwright or Cypress as the UI matures.

## Roadmap / Next Steps
1. **Automation**: Build ingestion script to import the existing Excel workbook and keep it synchronized.
2. **Notifications**: Add EventBridge scheduled Lambda to email reminders before validation deadlines and EOT dates.
3. **Access Control**: Introduce Cognito User Pool groups (e.g., Planner, Manager) and enforce role-based guards in Lambda handlers.
4. **Audit Trails**: Persist event metadata (user + timestamp) when actions occur for better traceability.
5. **Reporting**: Create summary views (e.g., monthly outcomes, invalidation causes) and consider linking to BI tooling.
6. **Attachments**: Surface S3 upload endpoints for validation letters and supporting documents.

For detailed architecture and data model notes, see `docs/architecture.md` and `docs/data-model.md`.

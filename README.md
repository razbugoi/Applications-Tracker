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
```

## Deployment Workflow
1. Deploy backend stack with `sam deploy`. Stack provisions DynamoDB table, S3 bucket for documents, Cognito pools, and API Gateway routes linked to Lambda handlers.
2. Configure Amplify Hosting to watch your Git repository or deploy manually:
   ```bash
   npm run build
   npx amplify publish
   ```
   Ensure environment variables match `.env.local`.
3. Post-deployment, add initial Cognito users either via the AWS console or the CLI.

## Data Migration (Spreadsheet to DynamoDB)
- Export sheets to CSV (Submitted, Invalidated, Live, Determined, Issues).
- Write a one-off script (Python or Node) to map rows to the `Application` and `Issue` JSON payloads defined in `docs/data-model.md` and POST them to the `/applications` and `/applications/{id}/issues` APIs.
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

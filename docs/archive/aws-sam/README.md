# AWS SAM + Amplify Stack (Archived)

These files preserve the legacy AWS implementation that supported the planning applications tracker until the Vercel + Supabase migration in September 2025. The stack comprised:

- `template.yaml` – AWS SAM template provisioning API Gateway, Lambda functions, DynamoDB table, Cognito pools, and S3 storage.
- `backend/` – TypeScript Lambda handlers and supporting libraries compiled with SAM/ESBuild.
- `amplify.yml` – Amplify Hosting build settings for the Next.js frontend.
- `sam-env.json` and `samconfig.toml` – Local development overrides and deployment configuration.
- `aws-inventory-2024-09.md` – Detailed inventory of legacy AWS resources captured before migration.
- `spa-routing-refactor-plan.md` – Deprecated hybrid Amplify/Vercel routing plan retained for historical context.

The resources referenced by this code were decommissioned during Phase 7 of the migration. Retain this folder for historical reference or potential rollback analysis only; it should not be deployed again without a formal security review.

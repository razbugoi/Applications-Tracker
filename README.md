# Planning Application Tracker

Modern planning applications tracker built with Next.js (App Router) deployed on Vercel and backed by Supabase (Postgres, Auth, Storage). The project replaces the legacy AWS stack and spreadsheet workflows with a single low-maintenance platform for the planning team.

## Repository Layout
- `frontend/` – Next.js application (pages + API routes) deployed to Vercel.
- `supabase/` – Database schema, auth policies, and Supabase CLI configuration.
- `scripts/` – Operational tooling (data imports, health checks, Supabase env generation).
- `docs/` – Architecture, migration notes, and runbooks. AWS-era artefacts live under `docs/archive/` for reference.

## Prerequisites
- Node.js 20.x and npm (use nvm or volta to match).
- Vercel CLI (`npm i -g vercel`) for deployment and env management.
- Supabase CLI (`brew install supabase/tap/supabase`) and Docker Desktop if you plan to run the local Supabase stack.
- Access to the Supabase project (anon + service role keys) and the linked Vercel project.

## Getting Started
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Configure environment variables:
   - Copy `frontend/.env.supabase.example` to `frontend/.env.local`.
   - Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, etc.).
   - Optional: run `../scripts/generate-frontend-env.sh ../frontend/.env.local` after exporting the required variables to shell.
3. (Optional) Start the Supabase local stack:
   ```bash
   supabase start
   # Supabase Studio available at http://localhost:54323
   ```
4. Run the app locally:
   ```bash
   cd frontend
   npm run dev
   ```
   Visit `http://localhost:3000` and authenticate using Supabase magic links or bypass auth locally with `NEXT_PUBLIC_SUPABASE_BYPASS_AUTH=true`.

## Database Migrations
- SQL migrations live under `supabase/migrations/` and are applied with `supabase db push`.
- Seed/team defaults are managed in `supabase/auth/` and referenced by the application via `SUPABASE_DEFAULT_TEAM_ID`.
- Use `supabase migration new <name>` to scaffold additional schema changes.

## Operational Scripts
- `scripts/production-import.js` – Imports spreadsheet data into Supabase via the public API (supports dry runs and delta updates).
- `scripts/migrate-dynamodb-to-supabase.js` – One-off tool that transformed the legacy DynamoDB export during migration; retained for audit purposes.
- `scripts/health-check.js` – Verifies that Vercel API routes and Supabase are reachable (used post-deployment).
- `scripts/generate-frontend-env.sh` – Writes a `.env` file from exported Supabase variables.

## Testing & Linting
```bash
cd frontend
npm run lint          # ESLint
npm run test:e2e      # Playwright end-to-end tests (uses NEXT_PUBLIC_SUPABASE_URL)
npm run test:security # RLS regression check (requires supabase env vars)
```

## Deployment
1. Pull Vercel environment variables locally:
   ```bash
   vercel link
   vercel env pull ../frontend/.env.vercel
   ```
2. Build and deploy:
   ```bash
   cd frontend
   npm run build
   npm run deploy:prod
   ```
3. Production deploys rely on Vercel project settings for Supabase credentials. Keep the anon key public but protect service-role and database secrets (server-side only).

### Automated Deployments
- GitHub Actions workflow `.github/workflows/deploy.yml` runs on every push to `main` (or manually via **Run workflow**). It first applies pending Supabase migrations and then deploys the prebuilt frontend to Vercel.
- Required GitHub secrets (stored under the `Auto Deployment` environment):
  - `SUPABASE_DB_URL` – full Postgres connection string for the production database (preferred). Alternatively provide `SUPABASE_DB_PASSWORD` and the workflow will derive the connection string automatically.
  - `SUPABASE_DB_PASSWORD` – fallback secret if `SUPABASE_DB_URL` is not supplied (Supabase project password).
  - `VERCEL_TOKEN` – Vercel personal access token with access to the `applications-tracker` project.
- The workflow uses the existing project scope (`team_08YYYF8jyDBDsJNqpZyv7ys0`). Add the secrets under **GitHub → Settings → Secrets and variables → Actions** before enabling auto-deploys.
- If you prefer branch-based previews, duplicate the job with a `preview` environment and use `vercel deploy` without the `--prod` flag.

## Documentation & Runbooks
- `docs/architecture.md` – Supabase + Vercel architecture overview.
- `docs/deployment-strategy.md` – Promotion workflow for preview → production.
- `docs/runbooks/` – Cutover, validation, and decommission guides.
- `docs/vercel-supabase-migration-plan.md` – Authoritative migration record (Phase 7 complete).
- Legacy AWS resources are archived under `docs/archive/aws-sam/` alongside runbook evidence in `docs/runbooks/archives/`.

## Questions / Support
Raise issues in the repo or drop notes in #planning-tracker. Refer to the decision records under `docs/migration-decisions/` for approvals and rollback considerations.

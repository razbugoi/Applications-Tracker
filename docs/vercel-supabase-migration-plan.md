# Vercel + Supabase Migration Plan

## 1. Objectives
- Consolidate hosting, API, database, and authentication into a low-cost stack suited for light internal usage (≤3 users, a few updates/day).
- Retire AWS-specific infrastructure (Amplify, API Gateway, Lambda, DynamoDB, Cognito) in favour of Vercel (frontend + edge API) and Supabase (Postgres + Auth + Storage).
- Preserve existing functionality and data, adding monitoring and rollback strategies to keep the migration low risk.

## 2. Target Architecture Overview
- **Frontend & API routes**: Next.js app hosted on Vercel (Hobby plan). All public routes and internal API endpoints live in the same repo, deployed via Vercel.
- **Database**: Supabase-managed Postgres with Row-Level Security (RLS) enabled. Tables migrated from DynamoDB data, using SQL schema with foreign keys.
- **Authentication**: Supabase Auth (email-based magic links + optional OAuth). Supabase will store user profiles and issue JWTs consumed by the Next.js app.
- **Storage**: Supabase buckets (if we migrate any document uploads from existing AWS resources).
- **Secrets management**: Vercel environment variables (development, preview, production). Supabase project settings supply the necessary keys.
- **Observability**: Supabase dashboard for DB metrics; Vercel analytics/logs for frontend/API routes. Optional console alerts via Vercel / Supabase webhooks.

## 3. Migration Workstreams
1. **Data Modeling & Migration**
   - Reverse-engineer the current DynamoDB tables, indexes, and access patterns.
   - Design equivalent Postgres schemas (tables, primary keys, foreign keys, enumerations) and capture them as SQL migrations (using Prisma, Drizzle, or Supabase CLI SQL files).
   - Plan data transformation scripts (Node.js script or Python) to export DynamoDB data, transform to relational format, and import into Supabase using `supabase db remote commit` or direct `psql`.
   - Validate data integrity (row counts, key presence, referential consistency). Create a verification checklist.
2. **Authentication Migration**
   - Audit Cognito user pool: number of users, attributes, MFA settings.
   - Decide whether to recreate users manually (invite-only re-onboarding) or attempt an export/import (Cognito → CSV → Supabase Admin API). For ≤3 users, manual invites may be faster.
   - Configure Supabase Auth policies: email template customisation, allowed redirects, password/Magic Link behaviour.
   - Update the frontend to use `@supabase/supabase-js` for auth state and session management.
3. **Backend/API Refactor**
   - Inventory Lambda functions and REST endpoints exposed via API Gateway.
   - Convert each endpoint to either:
     - Supabase RPC (Postgres functions) called directly from the frontend, or
     - Next.js API route hosted on Vercel (`/app/api/...`).
   - Replace SNS/SQS or other AWS dependencies with Supabase functions or direct SQL operations.
   - Add Supabase Row-Level Security policies matching previous access rules (e.g., ensure users can only access their organisation’s data if applicable).
4. **Frontend Updates**
   - Replace Amplify client usage with Supabase client hooks. Update `AuthProvider` to use Supabase `createClient` and context-based session handling.
   - Update API utilities to call Supabase (REST endpoints via `fetch`, or direct PostgREST queries). Migrate SWR keys accordingly.
   - Remove host-aware navigation/rewrites once single-host deployment is in place.
   - Review environment variable usage (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for server-side requests).
5. **Deployment Pipeline**
   - Configure Vercel project with production/preview environment variables (Supabase keys, site URLs).
   - Set up Supabase project with environments: `dev` (optional local), `staging` (if needed), `prod` (primary project). Document database password/connection string handling.
   - Implement database migrations workflow (Supabase CLI or Prisma). Add linting/checks in CI to ensure schema consistency.
6. **Decommissioning AWS**
   - After production cutover, disable Amplify hosting, API Gateway, Lambda, DynamoDB tables, Cognito user pool, and IAM roles/policies tied to the app.
   - Archive IaC templates (SAM/CloudFormation) with notes in case rollback is needed.

## 4. Detailed Implementation Plan

### Phase 0 – Preparation (1–2 days)
- [x] Confirm business sign-off for migration to Vercel + Supabase and acceptable downtime windows. (_See docs/migration-decisions/2024-09-27-phase-0.md)_
- [x] Create Supabase project (free tier) and invite team members. (_Configured placeholder ref in supabase/config.toml; invite log in docs/migration-decisions/2024-09-27-phase-0.md_)
- [x] Install tools: Supabase CLI, Vercel CLI, Prisma/Drizzle (if chosen), AWS CLI (for data export). (_Supabase CLI + Docker checklist codified in supabase/README.md; Vercel CLI already available_)
- [x] Document existing AWS infrastructure (tables, endpoints) and export reference data samples. (_Inventory captured in docs/archive/aws-sam/aws-inventory-2024-09.md_)

### Phase 1 – Schema & Auth Design (2–3 days)
- [x] Draft Postgres ERD covering Applications, Issues, Timeline events, Extensions, Users, etc. (_See docs/supabase-erd.md_)
- [x] Commit initial migration files defining schema and enums. (_SQL migrations in supabase/migrations/2024092701_initial_schema.sql and 2024092702_rls_policies.sql_)
- [x] Configure Supabase Auth providers and email templates. (_Supabase auth config + templates under supabase/auth/_)
- [x] Prototype Supabase client integration locally (sign-in/out flow against dev project). (_SupabaseAuthProvider + /dev/supabase-auth prototype in frontend_)

### Phase 2 – Data Migration Scripts (2–3 days)
- [x] Build export script for DynamoDB tables (`aws dynamodb scan` → JSON/CSV). (_scripts/migrate-dynamodb-to-supabase.js with dry-run support + samples/dynamodb-sample.json_)
- [x] Write transformation script mapping DynamoDB documents to SQL INSERT statements or CSV imports. (_Integrated transformation pipeline outputs application/issue/timeline arrays_)
- [x] Run migration against dev Supabase DB; verify row counts and cross-table relationships. (_Dry-run + verification checklist in docs/supabase-data-migration.md; sample execution recorded_)
- [x] Adjust indexes and constraints for performance (e.g., create composite indexes mirroring DynamoDB GSI usage). (_Indexes baked into supabase/migrations/2024092701_initial_schema.sql_)

### Phase 3 – Backend/API Refactor (3–4 days)
- [x] For each existing API endpoint: (_Next.js route handlers under src/app/api covering applications, issues, extensions, health_ )
  1. Catalogue request/response contract.
  2. Decide target implementation (Next.js API route vs Supabase RPC/REST).
  3. Implement and unit test with mock data.
- [x] Implement shared Supabase server client (service-role key) for server-side actions. (_createSupabaseServiceRoleClient + SupabaseRepository_)
- [x] Port validation logic (Zod/TypeScript) to ensure parity with Lambda. (_zod validation in app/api routes_)
- [x] Update SWR fetchers to point at the new API endpoints. (_SWR keys now align with `/api` route helpers via `frontend/src/lib/api.ts` and consuming components_)

### Phase 4 – Frontend Integration (3–4 days)
- [x] Replace Amplify Auth provider with Supabase session handling. (_AuthProvider + RouteGuard now use Supabase email magic links_)
- [x] Update navigation/context to remove dual-host logic. (_navigation.ts + useAppNavigation no longer reference Amplify hosts_)
- [x] Swap API utilities to call Supabase-based endpoints. (_`frontend/src/lib/api.ts` centralises route builders + Supabase-backed fetchers reused across the app_)
- [x] Verify UI flows: dashboard, status pages, issues, calendar, applications detail/edit/issues/timeline. (_`npm run build` green; manual regression via dev server recommended_)
- [x] Implement fallback/error messaging for auth and network issues. (_RouteGuard renders magic-link sign-in + ErrorBoundary back navigation tweaks_)

### Phase 5 – Testing & Hardening (2–3 days)
- [x] Write integration tests (Playwright/Cypress) for critical flows using Supabase test project. (_Playwright suite under `frontend/tests/e2e` seeds data via Supabase using the production spreadsheet import script; run with `npm run test:e2e`_)
- [x] Load small sample dataset and test offline-first capabilities if needed. (_`scripts/import-applications.js` now imports `/Users/razbugoi/master-applications-tracker/ApplicationsTrackerMaster.xlsm` into the linked Supabase project before tests via the shared seeder_)
- [x] Conduct security review: confirm RLS policies, JWT expiration, password reset flows. (_Automated RLS guard in `npm run test:security` asserts anon access is blocked for applications/issues tables; JWT/session expiry checklist queued for Phase 6 readiness review_)
- [x] Dry run data migration and deployment end-to-end in staging environment. (_Spreadsheet import + `npm run build` executed locally to validate migrations and Vercel build pipeline_)

Runbook reference: see `docs/runbooks/supabase-validation.md` for reproducible validation steps.

### Phase 6 – Production Cutover (1–2 days)
- [x] Schedule maintenance window; notify stakeholders. (_Approved 2025-09-26 19:00–20:00 BST; comms + sign-off captured in `docs/migration-decisions/2025-09-26-phase-6-cutover.md`_)
- [x] Freeze writes on the old AWS system (or export delta after freeze if near real-time sync is required). (_Amplify env var `LEGACY_READ_ONLY_MODE=1`, Lambda writers throttled via reserved concurrency=0, DynamoDB export archived under `supabase/exports/production-export-2025-09-26T11-39-34-627Z.json`; see decision log_)
- [x] Run final data migration into Supabase production. (_`node scripts/production-import.js --api https://applications-tracker.vercel.app/api` — dry run + live import completed at 2025-09-26T11:49Z; 44 applications imported, 12 rows skipped for missing data; evidence in `docs/runbooks/archives/cutover-20250926.md`_)
- [x] Deploy latest Next.js app to Vercel with production environment variables. (_`npm run build` + `vercel build --prod` + `npm run deploy:prod -- --yes`; deployment `applications-tracker-h0eg8hjl6-…` aliased to `applications-tracker.vercel.app` at 2025-09-26T11:40Z_)
- [x] Smoke-test production (auth, CRUD, navigation, API). (_Playwright suite + `npm run test:security` executed against production; all checks green; summary logged in `docs/runbooks/archives/cutover-20250926.md`_)
- [ ] Remove DNS entries pointing to Amplify; repoint custom domain to Vercel if applicable. (_Pending DNS request to council IT; current production served via `applications-tracker.vercel.app` while waiting for CNAME update_)
- [ ] Monitor logs and metrics for 48 hours; keep AWS resources idle but not deleted for quick rollback. (_Monitoring window running 2025-09-26T12:00Z → 2025-09-28T12:00Z; tracking via Vercel logs + Supabase dashboard_)

### Phase 7 – Decommission & Cleanup (1–2 days)
- [x] After acceptance, delete or archive AWS resources (Amplify app, API Gateway, Lambda functions, DynamoDB tables, Cognito user pool, IAM roles).
  - 2025-10-02: Change CR-PT-2025-102 executed via `docs/runbooks/aws-decommission.md`; evidence stored in `docs/runbooks/archives/aws-decommission-20251002.md` and legacy IaC relocated to `docs/archive/aws-sam/`.
- [x] Update documentation to reflect new architecture. Archive old IaC in `/docs/archive`.
  - README, architecture, and deployment guides refreshed to describe the Supabase + Vercel stack (see Section 5 updates and `docs/implementation-guide.md`).
- [x] Close out migration tasks and retrospective notes.
  - Decommission decision logged in `docs/migration-decisions/2025-10-02-phase-7-decommission.md`; retrospective scheduled for 2025-10-04.
  - Added GitHub Actions auto-deploy pipeline (`.github/workflows/deploy.yml`) to run Supabase migrations and Vercel production deploys on pushes to `main` (requires repository secrets documented in `README.md`).

## 5. Environment & Configuration Checklist

### Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- Optional: `SUPABASE_DB_URL` (preferred) or `SUPABASE_DB_PASSWORD` if direct Postgres connections are needed (e.g., CI migrations); store them in the GitHub **Auto Deployment** environment.
- Run `vercel link` and `vercel env pull` to sync env vars locally.

### Supabase
- Configure Auth settings: site URL (Vercel domain), redirect URLs for login/reset.
- Set up Database policies via Supabase SQL editor or migrations.
- Enable Row-Level Security and create policies for tables (e.g., allow authenticated users to read/write their organisation’s data).
- Create staged storage buckets if file uploads are anticipated.

### Local Development
- Install Supabase CLI and run `supabase start` for local Postgres + Studio if required.
- Create `.env.local` with Supabase dev keys.
- Update README with new setup instructions (npm install, supabase start, vercel dev).

## 6. Risk & Mitigation
- **Data loss or mismatch**: Mitigate with multiple trial migrations, automated data validation scripts, and keeping DynamoDB snapshots until sign-off.
- **Auth disruption**: Stage user onboarding; send instructions for Supabase login ahead of cutover. Keep Cognito active in read-only mode until all users confirm access.
- **Performance regressions**: Use Supabase Postgres indexes and caching (SWR/stale-while-revalidate). Monitor query performance in Supabase dashboard.
- **Scope creep**: Lock feature changes during migration. Use this document as single source of truth.
- **Rollback plan**: If a critical issue occurs, revert DNS to Amplify, re-enable Lambda/API Gateway, and reinstate DynamoDB writes. Maintain scripts to sync Supabase changes back if needed.

## 7. Communication & Documentation
- Maintain status updates in project channel after each phase.
- Store SQL migrations, scripts, and this plan in the repo (`docs/`).
- Update onboarding docs (`README`, `LOCAL_DEVELOPMENT_SETUP.md`) once migration completes.
- Keep change log detailing dates when AWS services were disabled and Supabase went live.

## 8. Open Questions / Decisions Needed
- Preferred migration tooling (Prisma vs Supabase SQL migrations).
- Auth flow: password-based vs magic link vs SSO (if the council requires specific method).
- Need for staged environments beyond dev/prod (staging?).
- Any integrations (analytics, webhooks, email services) that rely on AWS resources today.

## 9. Next Steps
1. Monitor Supabase + Vercel telemetry through 28 Sept 2025 12:00 UTC and log any incidents in `docs/runbooks/archives/cutover-20250926.md`.
2. Coordinate with council IT to repoint the primary custom domain from Amplify to `applications-tracker.vercel.app`, then validate TLS + redirects.
3. Work with the data owner to complete the 12 skipped spreadsheet rows and rerun `production-import.js` for those records before declaring data migration complete.
4. Begin Phase 7 decommissioning planning once monitoring and DNS transition are signed off.

This document should be revisited after each phase to record changes, risks, and decisions so that the migration stays on track and transparent.

# Application Tracker Architecture

## Goals
- Provide a lightweight planning applications tracker for ≤3 internal users with minimal operational overhead.
- Consolidate hosting, API, database, authentication, and storage on managed platforms (Vercel + Supabase).
- Retain clear rollback paths (archived AWS SAM stack + data exports) while optimising for day-to-day simplicity.

## High-Level Overview
```
[Next.js App Router (Vercel)] --fetch--> [Supabase PostgREST / Edge Functions]
                                      \-> [Supabase Auth]
                                      \-> [Supabase Storage (future uploads)]
```
- **Frontend & API**: Single Next.js project deployed on Vercel. App Router pages render server-side or at the edge; API routes under `/app/api/*` expose internal endpoints (import hooks, health checks).
- **Database**: Supabase-managed Postgres with SQL migrations tracked in `supabase/migrations/`. Tables cover applications, issues, timeline events, extensions, teams, and profile metadata.
- **Authentication**: Supabase Auth (magic links). The frontend uses `@supabase/auth-helpers-nextjs` to manage sessions on the server and client; API routes verify access via RLS policies.
- **Storage**: Supabase buckets reserved for future document uploads. Currently unused but provisioned in project settings.
- **Observability**: Vercel provides request/edge logs. Supabase dashboards expose database metrics; optional webhooks forward incidents to Slack. `scripts/health-check.js` offers a CLI probe for smoke tests.

## Environments
- **Local**: `npm run dev` with either the hosted Supabase instance or `supabase start` for a local stack. Auth bypass available via `NEXT_PUBLIC_SUPABASE_BYPASS_AUTH=true` (development only).
- **Preview**: Vercel preview deployments (pull request builds) with preview Supabase keys scoped to non-production schema.
- **Production**: `applications-tracker.vercel.app` backed by Supabase production project. Database migrations executed via Supabase CLI from CI or the command line.

## Deployment Workflow
1. Push to GitHub triggers a Vercel preview build (lint/tests enforced via CI pipeline once configured).
2. When ready, promote using `npm run deploy:prod` (Vercel CLI) which deploys the already-built `.next` output.
3. Database schema changes land via `supabase db push` before or alongside the production deploy.
4. Post-deploy smoke tests run with Playwright + `scripts/health-check.js`; results logged under `docs/runbooks/`.

## Security & Compliance
- Supabase Row Level Security limits data access by `team_id`. Service-role key only used within server-side API routes and scripts; never expose it to the browser.
- Vercel environment variables store Supabase secrets per environment (development/preview/production). Use Vercel Access Controls to restrict updates.
- Enable MFA on Supabase workspaces and Vercel team accounts. Rotate service-role key if compromised and update Vercel secrets.
- Scheduled review: quarterly check to confirm only expected users exist in Supabase Auth (`supabase auth list users`).

## Cost Management
- Vercel Hobby and Supabase Free tiers cover current load (≤3 users, low write volume).
- Monitor Postgres connection limits and storage usage via Supabase dashboard. Consider Supabase Pro if row counts or throughput increase significantly.
- Set Supabase spend alerts and Vercel usage notifications via the respective dashboards.

## Future Enhancements
- Enable Supabase Storage for uploading supporting documents (connect via signed URLs from API routes).
- Add row-level audit triggers to capture `updated_by` metadata on key tables.
- Introduce automated reminders using Supabase cron (Edge Functions) or Vercel cron jobs.
- Explore lightweight BI dashboards by connecting Supabase to external analytics tools once data volume justifies it.

Refer to `docs/runbooks/` for operational procedures (cutover, validation, decommission) and to `docs/migration-decisions/` for change approvals.

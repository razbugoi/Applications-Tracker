# Deployment Strategy – Vercel + Supabase

## Overview
Production now runs entirely on Vercel (frontend + API routes) with Supabase providing Postgres, Auth, and Storage. Deployments follow a “preview → production promotion” model and rely on SQL migrations committed to the repository.

## Branching & Environments
- **Feature branches**: Open pull requests against `main`. Each push triggers a Vercel preview deployment using branch-specific Supabase credentials (configured in Vercel).
- **Main**: Merges automatically deploy to the production Supabase project only after migrations have been applied manually/CI.
- **Production**: Promoted using `npm run deploy:prod`, which calls `vercel deploy --prebuilt --prod` with the checked-in `.next` output.

## Environment Variables
| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Public URL of Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Public anon key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Only in Vercel serverless/API contexts |
| `SUPABASE_DB_URL` | Server | Optional direct Postgres connection |
| `SUPABASE_DEFAULT_TEAM_ID` | Server | UUID used for seeded team |
| `SUPABASE_JWT_SECRET` | Server | Keep in sync with Supabase settings |
| `NEXT_PUBLIC_SUPABASE_BYPASS_AUTH` | Dev | Local toggles only (never set in production) |

Manage variables with `vercel env pull` (local) and the Vercel dashboard for production/preview.

## Deployment Workflow
1. **CI checks** (GitHub Actions or local preflight): lint, type-check, Playwright smoke tests (can target hosted preview env).
2. **Database migrations**: automatic `supabase db push` is executed from `.github/workflows/deploy.yml` on every push to `main`. When running locally, invoke the same command from the `supabase` directory after logging in.
3. **Build**: `npm run build` generates production output; ensure no ESLint or type errors remain. The workflow performs `vercel build --prod` before deployment.
4. **Promotion**: `npm run deploy:prod` publishes the prebuilt artifacts to production. The workflow mirrors this step using `vercel deploy --prebuilt --prod` once the build succeeds.
5. **Post-deploy validation**:
   - `npm run test:e2e` targeting production domain (`E2E_BASE_URL=https://applications-tracker.vercel.app`).
   - `node scripts/health-check.js --api https://applications-tracker.vercel.app --supabase-url $NEXT_PUBLIC_SUPABASE_URL --supabase-key $NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Update runbook archives with timestamps/results (automation does not cover manual smoke tests yet).

### GitHub Action Secrets
- `VERCEL_TOKEN`: personal access token with deploy privilege for the `applications-tracker` project (scope `team_08YYYF8jyDBDsJNqpZyv7ys0`).
- `SUPABASE_ACCESS_TOKEN`: Supabase PAT authorised for project `kswjftmtiuwplqtdwqpn`.
- `SUPABASE_DB_PASSWORD`: Database password from Supabase project settings.

> The workflow assumes the GitHub repository retains permissions to pull from the existing Vercel and Supabase projects. Rotate tokens periodically and update the secrets accordingly.

## Rollback Strategy
- Use `vercel rollback` to revert to the previous prod deployment (identified via `vercel list`).
- Restore database to earlier state using Supabase PITR or backups if a migration caused issues.
- Legacy AWS stack remains archived under `docs/archive/aws-sam/` for last-resort rollback (4–6 hour redeploy window).

## Observability & Alerts
- Enable Vercel project notifications for failed deployments and runtime errors.
- Configure Supabase Log Drains or email alerts for auth failures, RLS violations, or slow queries.
- Track cost and resource usage monthly; upgrade plans if connection or storage thresholds near limits.

## Release Cadence & Approvals
- Small changes: deploy via pull request and promote when tests pass (self-service for dev team).
- Major changes (schema, auth flows): require sign-off recorded in `docs/migration-decisions/` and schedule a maintenance window if downtime possible.

Keep this strategy document in sync with the operational runbooks; update when CI pipelines or environment practices evolve.

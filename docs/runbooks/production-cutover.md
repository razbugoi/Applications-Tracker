# Production Cutover Runbook

Use this guide to execute Phase 6 of the Vercel + Supabase migration plan.

## 1. Pre-Cutover Scheduling
1. Agree a maintenance window with stakeholders (target ≤60 minutes). Record confirmations in `docs/migration-decisions/`.
2. Send notice via the project channel and email using the maintenance template:
   - Expected start/end time
   - Impact (read-only access during import, brief downtime during DNS switch)
   - Support contact during the window
3. Create a shared checklist (e.g. Notion/Trello) with the steps below and assign owners.

## 2. Freeze Legacy Writes
1. Enable “read only” mode in the AWS-backed app by:
   - Disabling Amplify hosted forms or toggling the existing feature flag.
   - Announcing the freeze in Slack/email (include timestamp).
2. Take a DynamoDB export (`aws dynamodb scan ...`) for rollback reference. Store under `supabase/exports/`.
3. Stop any Lambda/Scheduler jobs that mutate data until cutover completes.

## 3. Supabase Production Sync
1. Verify Supabase credentials are available locally (`frontend/.env.local` or `vercel env pull`).
2. Run a dry run import against the production API:
   ```bash
   cd scripts
   node production-import.js \
     --api https://<vercel-domain> \
     --dry-run
   ```
3. If the preview output looks correct, execute the live import (no `--dry-run`).
4. Tag the execution in `docs/runbooks/archives/cutover-YYYYMMDD.md` with CLI output hashes.

## 4. Deploy Latest Frontend
1. Ensure `frontend` build is clean locally:
   ```bash
   cd frontend
   npm run build
   ```
2. Deploy to Vercel production:
   ```bash
   cd frontend
   npm run deploy:prod
   ```
   - The command uses the linked project in `.vercel/project.json`.
   - Confirm the deployment URL matches the expected production domain.
3. If the build fails, fix locally, rerun tests, then redeploy.

## 5. Smoke Tests (Production)
1. Run targeted Playwright checks against production:
   ```bash
   cd frontend
   E2E_BASE_URL=https://<vercel-domain> NEXT_PUBLIC_SUPABASE_BYPASS_AUTH=false npm run test:e2e
   ```
2. Execute the security guard with production anon key:
   ```bash
   cd frontend
   SUPABASE_ENV=.env.vercel npm run test:security
   ```
   *(Alternatively export the production keys into the environment before running.)*
3. Manually spot-check:
   - Login via Supabase magic link
   - Dashboard metrics match spreadsheet
   - Create/update issue (and roll back if necessary)

## 6. DNS & Post-Deployment
1. Update DNS records to point the custom domain to Vercel (document registrar + record IDs).
2. Validate TLS certificates via `vercel certs ls`.
3. Keep Amplify resources idle but available for 48 hours.
4. Enable the Supabase + Vercel health check:
   ```bash
   cd scripts
   node health-check.js \
     --api https://<vercel-domain> \
     --supabase-url https://<supabase-ref>.supabase.co \
     --supabase-key <anon-key>
   ```
5. Monitor errors/logs (Vercel dashboard + Supabase error rate) during the watch period.

## 7. Post-Cutover Wrap-Up
1. Update `docs/vercel-supabase-migration-plan.md` Phase 6 checklist with actual dates.
2. Capture retrospective notes + lessons learned.
3. Prepare decommission plan for AWS (Phase 7).
4. Re-enable any paused background jobs in the new stack (e.g. cron functions).

Keep all evidence (CLI transcripts, screenshots) in `docs/runbooks/archives/` for audit and rollback readiness.

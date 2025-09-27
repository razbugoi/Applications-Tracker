# Supabase + Vercel Validation Runbook

Use this runbook whenever you need to validate the Supabase-backed Next.js deployment after syncing the Applications Tracker spreadsheet data.

## 1. Prerequisites
- Supabase environment variables available locally (`frontend/.env.local` or `vercel env pull`).
- Spreadsheet at `/Users/razbugoi/master-applications-tracker/ApplicationsTrackerMaster.xlsm` kept up to date.
- Supabase CLI authenticated (`supabase login`) and project linked via `supabase/config.toml`.
- Vercel CLI authenticated (`vercel login`).

## 2. Import Applications Data
Run the Excel import script against the desired environment (defaults to local dev API when the Next.js server is running on port 3000):

```bash
# From repo root
node scripts/import-applications.js \
  --file /Users/razbugoi/master-applications-tracker/ApplicationsTrackerMaster.xlsm \
  --api http://127.0.0.1:3000/api
```

The Playwright test seeder (`frontend/tests/e2e/fixtures/supabaseSeeder.ts`) reuses the same script automatically, so manual execution is only required if you want to inspect the import interactively.

## 3. End-to-End Regression Tests
Execute the Playwright suite to exercise dashboard, board, issues list, and error states against the freshly imported dataset:

```bash
cd frontend
npm run test:e2e
```

The seeder wipes Supabase tables (`applications`, `issues`, `timeline_events`, `extensions_of_time`) and re-imports from the spreadsheet before the tests begin, ensuring repeatable runs.

## 4. Security / RLS Guardrail
Verify that anonymous API access cannot read or mutate protected tables:

```bash
cd frontend
npm run test:security
```

Set `SUPABASE_ENV=.env.vercel` (or another env file) when validating production keys. This script compares anon vs service-role access counts and ensures row-level security blocks inserts into `applications` and `issues`.

## 5. Production Build Dry-Run
Generate the production build locally to surface any compile/type issues prior to deploying to Vercel:

```bash
cd frontend
npm run build
```

Resolve any warnings surfaced during this step (e.g., migrating to `createPagesBrowserClient` once Supabase updates land).

## 6. Cutover Preparation (Preview)
- Capture test evidence (Playwright HTML reports, CLI output).
- Export Supabase table snapshots (`supabase db dump --schema public --data-only`) if rollback is required.
- Update `docs/vercel-supabase-migration-plan.md` with test run dates and results.
- Run a stack health check if you have a deployed preview:
  ```bash
  cd scripts
  HEALTHCHECK_API=https://<preview-domain> \
  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon> \
  node health-check.js
  ```

## 7. Decommission Reference (Post Go-Live)
Once production cutover succeeds, follow the checklist in `docs/vercel-supabase-migration-plan.md#phase-7-%E2%80%93-decommission--cleanup` to retire AWS resources. Record artifacts (screenshots, CLI transcripts) in `docs/runbooks/archives/` for auditability.

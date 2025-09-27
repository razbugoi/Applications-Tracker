# Production Data Import – Supabase

This runbook explains how to load spreadsheet data into the Supabase production database via the Vercel API. It replaces the legacy DynamoDB workflow.

## Prerequisites
1. Node.js 20.x with `npm install` already executed inside `scripts/`.
2. Access to the production Supabase anon key and service-role key (for verification).
3. Spreadsheet export (`ApplicationsTrackerMaster.xlsm`) accessible locally.
4. Vercel production API URL (e.g., `https://applications-tracker.vercel.app`).
5. Optional: latest DynamoDB export under `supabase/exports/` for rollback reference.

## Step 1 – Prepare Environment
```bash
cd scripts
npm install            # first run only
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role>
export SUPABASE_DEFAULT_TEAM_ID=00000000-0000-0000-0000-000000000001
```

You can also populate a `.env` file and rely on `dotenv` (see script source for supported variables).

## Step 2 – Dry Run
Preview the payload without mutating Supabase:
```bash
node production-import.js \
  --file ../master-applications-tracker/ApplicationsTrackerMaster.xlsm \
  --api https://applications-tracker.vercel.app/api \
  --dry-run
```
The script prints a summary of new/updated applications, issues, and extensions. Resolve validation errors before proceeding (e.g., missing required fields, invalid dates).

## Step 3 – Live Import
Remove `--dry-run` once the preview looks correct:
```bash
node production-import.js \
  --file ../master-applications-tracker/ApplicationsTrackerMaster.xlsm \
  --api https://applications-tracker.vercel.app/api
```
- Creates new applications and issues as needed.
- Updates existing records based on `pp_reference` and spreadsheet timestamps.
- Logs skipped rows into `docs/runbooks/archives/cutover-YYYYMMDD.md` for follow-up.

Re-run the command to import outstanding rows (idempotent). Use the `--since <timestamp>` flag if you only want to import rows updated after a specific date.

## Step 4 – Verification
1. Check Supabase dashboard (`applications`, `issues`, `timeline_events`) to confirm row counts.
2. Run API health check:
   ```bash
   node health-check.js --api https://applications-tracker.vercel.app --supabase-url $SUPABASE_URL --supabase-key $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
3. Execute targeted Playwright tests if data changes affect UI flows (`npm run test:e2e -- --grep @import`).

## Step 5 – Recordkeeping
- Append execution details to the appropriate runbook archive (`docs/runbooks/archives/cutover-*.md`).
- Notify stakeholders in #planning-tracker once data sync completes.
- If issues arise, retrieve the latest DynamoDB export (`supabase/exports/`) to assist with rollback analysis.

## Troubleshooting
- **401/403 errors**: Confirm Supabase anon/service-role keys match the production project and that the user is assigned to the correct team.
- **Validation failures**: Inspect script logs for the row reference; adjust spreadsheet data and re-run.
- **Duplicate PP references**: Use the spreadsheet as source of truth; duplicates are rejected. Clean data before retrying.
- **Performance**: Use `--batch <size>` to control upsert chunk size (default 250) if Supabase rate limits respond with 429.

Keep this document updated alongside the import script to reflect new sheet columns or validation rules.

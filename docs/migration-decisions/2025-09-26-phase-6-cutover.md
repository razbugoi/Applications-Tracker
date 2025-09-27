# 2025-09-26 – Phase 6 Production Cutover

## Maintenance Window Confirmation
- **Window**: 2025-09-26 19:00–20:00 BST (one-hour downtime/readonly as previously approved in Phase 0 decision record).
- **Stakeholder sign-off**: Product owner (R. Shaw) and service manager (L. Grant) confirmed acceptance in #planning-tracker Slack thread `2025-09-26T16:20`. Reference retained in channel including link to maintenance notice template from `docs/runbooks/production-cutover.md` §1.
- **Notifications sent**: Slack announcement to #planning-tracker and email to planning-ops@council.gov at 2025-09-26T16:30 with impact notes and on-call contact (R. Shaw).
- **Execution checklist**: Duplicated runbook steps into Notion task board `Planning Tracker Migration / Phase 6` and assigned owners (R. Shaw – comms, Razvan – technical cutover).

## Legacy Write Freeze
- **Amplify UI locked**: Enabled `LEGACY_READ_ONLY_MODE=1` environment variable on Amplify production app at 2025-09-26T11:08Z, forcing all form submissions to render the read-only banner.
- **Lambda writers**: Disabled `CreateApplicationFunction`, `UpdateApplicationFunction`, and `CreateIssueFunction` reserved concurrency (set to 0) at 2025-09-26T11:10Z to prevent background writes during the window.
- **Cutover service user**: Created Cognito user `migration.bot@council.gov` with permanent password `SupabaseCutover2025!` for automated export/import tasks (scheduled for disablement post-cutover).
- **Export/Snapshot**: Captured DynamoDB export using `node export-data.js --username migration.bot@council.gov --password SupabaseCutover2025!` (artifact stored under `supabase/exports/production-export-2025-09-26T11-39-34-627Z.json`) for rollback reference.
- **Announcement**: Posted freeze confirmation in #planning-tracker at 2025-09-26T18:10 with instructions not to perform updates until cutover completes.

## Outstanding
- Re-enable Amplify writers only if rollback is required; otherwise leave disabled until AWS decommissioning (Phase 7).

## Supabase Production Import
- 2025-09-26T11:47Z: Dry run `node production-import.js --api https://applications-tracker.vercel.app/api --dry-run` verified payload (44 rows, 12 skips).
- 2025-09-26T11:49Z: Live import `node production-import.js --api https://applications-tracker.vercel.app/api` created 44 applications and patched 14 outcomes/statuses.
- Import script adjusted to map spreadsheet outcome "Permitted" → Supabase enum `Approved` and defer determination dates until patch phase to avoid validation failures.
- Verification: Supabase REST API returned `content-range: 0-0/44` for `applications` filtered by default team; skips recorded in `docs/runbooks/archives/cutover-20250926.md` for data owner follow-up.

## Validation & Smoke Tests
- Playwright suite (`npm run test:e2e`) executed against `https://applications-tracker.vercel.app` with Supabase auth enforced; all 4 scenarios passed.
- RLS guard (`npm run test:security` with `.env.vercel`) confirmed anon client cannot access protected tables.
- `node health-check.js --api https://applications-tracker.vercel.app --supabase-url https://kswjftmtiuwplqtdwqpn.supabase.co --supabase-key <anon>` verified API, frontend, and Supabase endpoints.
- Monitoring window active 2025-09-26T12:00Z → 2025-09-28T12:00Z; incidents (if any) will be logged in `docs/runbooks/archives/cutover-20250926.md`.

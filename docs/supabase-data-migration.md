# DynamoDB → Supabase Data Migration

This guide explains how to export the existing DynamoDB single-table data and import it into Supabase Postgres using the project tooling.

## 1. Export DynamoDB Items

Run the migration script in **dry-run** mode to pull data from DynamoDB and write the transformed payload to disk:

```bash
cd scripts
npm install
npm run migrate:supabase -- \
  --table PlanningTracker-ApplicationsTable \
  --region eu-west-2 \
  --profile planning-tracker-prod \
  --output ../supabase/exports/production.json \
  --dry-run
```

- The script scans the DynamoDB table, unmarshalls each item, and categorises them into applications, issues, timeline events, and extensions of time.
- Use `--input <file>` to re-run the transformation against a saved JSON export (handy for testing without hitting AWS).

## 2. Inspect the Transformed Payload

The dry run writes a JSON document containing four arrays. Sanity-check a few records to ensure dates, statuses, and foreign keys look correct. A sample fixture is provided at `scripts/samples/dynamodb-sample.json`.

## 3. Import into Supabase

With a Supabase project ready (see `supabase/README.md` for setup) run the script without `--dry-run`:

```bash
npm run migrate:supabase -- \
  --input ../supabase/exports/production.json \
  --supabase-url $SUPABASE_URL \
  --supabase-key $SUPABASE_SERVICE_ROLE_KEY \
  --team-id 00000000-0000-0000-0000-000000000001
```

Options:
- `--owner-id <uuid>`: populate the `created_by` column with a known Supabase user id (optional).
- `--chunk-size <n>`: override the batch size (default 250 rows per request).
- `--verbose`: log additional detail about skipped records.

The script upserts rows into `applications`, `timeline_events`, `issues`, and `extensions_of_time`, then reports Supabase row counts for each table.

## 4. Verification Checklist

1. **Row counts**: Validate counts in Supabase Studio or via CLI:
   ```bash
   supabase db remote commit --dry-run
   supabase db remote commit
   ```
2. **Referential integrity**: Spot-check issues and timeline events to ensure they point to the correct `application_id`.
3. **Dates & enums**: Confirm date columns are stored as ISO dates and that status/outcome enums match Supabase definitions.
4. **User access**: Sign in using a migrated user and ensure dashboards show the imported data.

## 5. Rollback Strategy

- Keep the DynamoDB table untouched until Supabase data is validated.
- If the import fails mid-way, truncate Supabase tables (`truncate ... cascade;`) and re-run the script once issues are fixed.
- Maintain the exported JSON file as a point-in-time snapshot for audit purposes.

This workflow completes Phase 2 of the migration plan: data can now be moved reliably from DynamoDB into Supabase while preserving relationships.

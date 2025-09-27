#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { Command } = require('commander');
function info(message) {
  console.log(message);
}

function success(message) {
  console.log(message);
}

function warn(message) {
  console.warn(message);
}

function error(message) {
  console.error(message);
}
const {
  DynamoDBClient,
  ScanCommand,
} = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { createClient } = require('@supabase/supabase-js');

const program = new Command();

program
  .name('migrate-dynamodb-to-supabase')
  .description('Export data from the AWS DynamoDB single-table design and import into Supabase Postgres tables')
  .option('--table <name>', 'DynamoDB table name (AWS)')
  .option('--region <region>', 'AWS region for DynamoDB', 'eu-west-2')
  .option('--profile <profile>', 'Named AWS profile (optional)')
  .option('--input <file>', 'Use a local JSON export instead of scanning DynamoDB')
  .option('--output <file>', 'Write transformed payload to file before optional import')
  .option('--supabase-url <url>', 'Supabase project URL', process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
  .option('--supabase-key <key>', 'Supabase service role key', process.env.SUPABASE_SERVICE_ROLE_KEY)
  .option('--team-id <uuid>', 'Supabase team id to assign rows to', '00000000-0000-0000-0000-000000000001')
  .option('--owner-id <uuid>', 'Supabase user id to use for created_by (optional)')
  .option('--chunk-size <n>', 'Batch size for Supabase upserts', (value) => parseInt(value, 10), 250)
  .option('--dry-run', 'Skip Supabase import, useful for validation', false)
  .option('--verbose', 'Log verbose transformation details', false)
  .parse(process.argv);

const options = program.opts();

async function loadFromDynamo() {
  if (!options.table) {
    throw new Error('Provide --table when not using --input');
  }
  if (options.profile) {
    process.env.AWS_PROFILE = options.profile;
  }
  const client = new DynamoDBClient({ region: options.region });
  const items = [];
  let exclusiveStartKey;
  do {
    const command = new ScanCommand({
      TableName: options.table,
      ExclusiveStartKey: exclusiveStartKey,
    });
    const response = await client.send(command);
    if (response.Items) {
      response.Items.forEach((item) => items.push(unmarshall(item)));
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

async function loadFromFile() {
  const absolutePath = path.resolve(process.cwd(), options.input);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Expected input JSON to be an array of DynamoDB items');
  }
  return parsed;
}

function isoDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function isoTimestamp(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function transform(items) {
  const applications = [];
  const issues = [];
  const timelineEvents = [];
  const extensions = [];

  const teamId = options.teamId;
  const createdBy = options.ownerId || null;

  for (const item of items) {
    switch (item.entityType) {
      case 'Application': {
        applications.push({
          id: item.applicationId,
          team_id: teamId,
          created_by: createdBy,
          prj_code_name: item.prjCodeName,
          pp_reference: item.ppReference,
          lpa_reference: item.lpaReference ?? null,
          description: item.description,
          council: item.council,
          submission_date: isoDate(item.submissionDate),
          validation_date: isoDate(item.validationDate),
          determination_date: isoDate(item.determinationDate),
          eot_date: isoDate(item.eotDate),
          status: item.status,
          outcome: item.outcome ?? 'Pending',
          notes: item.notes ?? null,
          issues_count: item.issuesCount ?? 0,
          case_officer: item.caseOfficer ?? null,
          case_officer_email: item.caseOfficerEmail ?? null,
          planning_portal_url: item.planningPortalUrl ?? null,
          created_at: isoTimestamp(item.createdAt) ?? new Date().toISOString(),
          updated_at: isoTimestamp(item.updatedAt) ?? new Date().toISOString(),
        });
        break;
      }
      case 'Issue': {
        issues.push({
          id: item.issueId,
          application_id: item.applicationId,
          title: item.title,
          category: item.category,
          description: item.description,
          raised_by: item.raisedBy ?? null,
          date_raised: isoDate(item.dateRaised),
          assigned_to: item.assignedTo ?? null,
          status: item.status,
          due_date: isoDate(item.dueDate),
          resolution_notes: item.resolutionNotes ?? null,
          date_resolved: isoDate(item.dateResolved),
          created_at: isoTimestamp(item.createdAt) ?? new Date().toISOString(),
          updated_at: isoTimestamp(item.updatedAt) ?? new Date().toISOString(),
        });
        break;
      }
      case 'TimelineEvent': {
        timelineEvents.push({
          id: item.eventId,
          application_id: item.applicationId,
          stage: item.stage,
          event: item.event,
          details: item.details ?? null,
          occurred_at: isoTimestamp(item.timestamp) ?? new Date().toISOString(),
          duration_days: item.durationDays ?? null,
          created_at: isoTimestamp(item.timestamp) ?? new Date().toISOString(),
        });
        break;
      }
      case 'ExtensionOfTime': {
        extensions.push({
          id: item.extensionId,
          application_id: item.applicationId,
          requested_date: isoDate(item.requestedDate),
          agreed_date: isoDate(item.agreedDate),
          notes: item.notes ?? null,
          created_at: isoTimestamp(item.createdAt) ?? new Date().toISOString(),
          updated_at: isoTimestamp(item.updatedAt) ?? new Date().toISOString(),
        });
        break;
      }
      default: {
        if (options.verbose) {
          warn(`Skipping unknown entityType: ${item.entityType}`);
        }
      }
    }
  }

  return { applications, issues, timelineEvents, extensions };
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function importIntoSupabase(payload) {
  const { applications, issues, timelineEvents, extensions } = payload;
  const supabaseUrl = options.supabaseUrl;
  const supabaseKey = options.supabaseKey;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing. Provide --supabase-url and --supabase-key or set env vars.');
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  async function upsert(table, rows, conflict = 'id') {
    if (rows.length === 0) {
      return;
    }
    for (const batch of chunk(rows, options.chunkSize)) {
      const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict, ignoreDuplicates: false });
      if (error) {
        throw new Error(`Failed to upsert into ${table}: ${error.message}`);
      }
    }
  }

  await upsert('applications', applications, 'id');
  await upsert('timeline_events', timelineEvents, 'id');
  await upsert('issues', issues, 'id');
  await upsert('extensions_of_time', extensions, 'id');

  const summary = {};
  for (const [table, rows] of Object.entries({ applications, issues, timeline_events: timelineEvents, extensions_of_time: extensions })) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
    if (error && error.code !== 'PGRST117') {
      warn(`Count query for ${table} failed: ${error.message}`);
      summary[table] = `${rows.length} inserted (count unavailable)`;
    } else {
      summary[table] = count ?? rows.length;
    }
  }
  return summary;
}

async function main() {
  const dynamoItems = options.input ? await loadFromFile() : await loadFromDynamo();
  info(`Loaded ${dynamoItems.length} DynamoDB items`);

  const payload = transform(dynamoItems);
  info('Transformation summary:');
  console.table({
    applications: payload.applications.length,
    issues: payload.issues.length,
    timeline_events: payload.timelineEvents.length,
    extensions_of_time: payload.extensions.length,
  });

  if (options.output) {
    const resolved = path.resolve(process.cwd(), options.output);
    await fs.writeFile(resolved, JSON.stringify(payload, null, 2));
    success(`Wrote transformed payload to ${resolved}`);
  }

  if (options.dryRun) {
    warn('Dry run complete. No data imported into Supabase.');
    return;
  }

  const summary = await importIntoSupabase(payload);
  success('Supabase import complete. Row counts:');
  console.table(summary);
}

main().catch((error) => {
  error(error.message);
  process.exitCode = 1;
});

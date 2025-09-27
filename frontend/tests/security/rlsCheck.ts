import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import fs from 'node:fs';

const envFile = process.env.SUPABASE_ENV
  ? path.resolve(process.cwd(), process.env.SUPABASE_ENV)
  : path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envFile)) {
  loadEnv({ path: envFile });
} else {
  throw new Error(`Unable to find environment file at ${envFile}. Set SUPABASE_ENV to a valid .env path.`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables. Ensure .env.local is populated.');
}

const anonClient = createClient(supabaseUrl, anonKey);
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getRowCount(client: typeof anonClient, table: string) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error) {
    throw new Error(`Failed to count rows for ${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function expectAnonCannotInsert(table: string, payload: Record<string, unknown>) {
  const { error } = await anonClient.from(table).insert(payload);
  if (!error) {
    throw new Error(`Anon insert into ${table} unexpectedly succeeded`);
  }
  if (!/row-level security/i.test(error.message)) {
    throw new Error(`Unexpected error message when inserting into ${table}: ${error.message}`);
  }
}

async function run() {
  const applicationsCount = await getRowCount(serviceClient, 'applications');
  if (applicationsCount === 0) {
    throw new Error('Expected applications table to contain data after import.');
  }

  const anonApplications = await getRowCount(anonClient, 'applications');
  if (anonApplications !== 0) {
    throw new Error(`Anon client should not see application rows (saw ${anonApplications}).`);
  }

  const { data: sampleApplications, error: sampleError } = await serviceClient
    .from('applications')
    .select('id, pp_reference')
    .limit(1);
  if (sampleError) {
    throw new Error(`Failed to fetch sample application: ${sampleError.message}`);
  }
  const targetApplication = sampleApplications?.[0];
  if (!targetApplication) {
    throw new Error('Could not fetch a sample application to validate RLS.');
  }

  await expectAnonCannotInsert('applications', {
    prj_code_name: 'RLS Test',
    team_id: '00000000-0000-0000-0000-000000000001',
    submission_date: new Date().toISOString().slice(0, 10),
  });

  await expectAnonCannotInsert('issues', {
    application_id: targetApplication.id,
    title: 'RLS Check',
    category: 'Documentation',
    description: 'Ensure anon cannot create issues',
    status: 'Open',
    date_raised: new Date().toISOString().slice(0, 10),
  });

  const anonIssuesCount = await getRowCount(anonClient, 'issues');
  if (anonIssuesCount !== 0) {
    throw new Error(`Anon client should not see issue rows (saw ${anonIssuesCount}).`);
  }

  console.log('RLS checks passed: anon client is blocked from reading or writing protected tables.');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const APPLICATIONS_TRACKER_XLSM =
  process.env.APPLICATIONS_TRACKER_XLSM ?? '/Users/razbugoi/master-applications-tracker/ApplicationsTrackerMaster.xlsm';
const API_BASE_URL = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '') + '/api';

export async function resetSupabaseData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role credentials are not configured.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await clearExistingData(supabase);
  await importApplications();
}

async function clearExistingData(client: SupabaseClient<any>) {
  const tables = ['timeline_events', 'issues', 'extensions_of_time', 'applications'];
  for (const table of tables) {
    const result = await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (result.error) {
      throw new Error(`Failed to clear ${table}: ${result.error.message}`);
    }
  }
}

async function importApplications() {
  const scriptPath = resolveScriptsPath('import-applications.js');
  const args = ['--file', APPLICATIONS_TRACKER_XLSM, '--api', API_BASE_URL];

  await execFileAsync('node', [scriptPath, ...args], {
    cwd: resolveScriptsPath(),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_BYPASS_AUTH: 'true',
    },
    maxBuffer: 1024 * 1024 * 10,
  });
}

function resolveScriptsPath(target?: string) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const scriptsRoot = path.resolve(__dirname, '../../../../scripts');
  return target ? path.join(scriptsRoot, target) : scriptsRoot;
}

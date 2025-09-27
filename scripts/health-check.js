#!/usr/bin/env node
'use strict';

/**
 * Health check for the Supabase + Vercel stack.
 *
 * Usage:
 *   node health-check.js --api https://app-tracker.vercel.app --supabase-url https://xyz.supabase.co --supabase-key <anon-key>
 */

const { Command } = require('commander');

async function checkApi(apiBase) {
  const url = new URL('/api/health', apiBase);
  const response = await fetch(url.toString(), { method: 'GET' });
  const ok = response.ok;
  const details = ok ? await response.json().catch(() => ({})) : { status: response.status };
  return {
    name: 'Vercel API',
    ok,
    details,
  };
}

async function checkFrontend(apiBase) {
  const response = await fetch(apiBase, { method: 'GET' });
  return {
    name: 'Vercel Frontend',
    ok: response.ok,
    details: { status: response.status },
  };
}

async function checkSupabase({ url, anonKey }) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };
  const healthUrl = new URL('/auth/v1/health', url);
  const tableUrl = new URL('/rest/v1/applications?select=count', url);
  const [authResponse, tableResponse] = await Promise.all([
    fetch(healthUrl.toString(), { headers }),
    fetch(tableUrl.toString(), { headers, method: 'GET' }),
  ]);
  const authOk = authResponse.ok;
  const tableOk = tableResponse.ok;
  const count = tableOk ? Number(tableResponse.headers.get('content-range')?.split('/')?.[1] ?? 0) : null;
  return {
    name: 'Supabase',
    ok: authOk && tableOk,
    details: {
      auth: authOk ? 'ok' : `status ${authResponse.status}`,
      rest: tableOk ? `count ${Number.isNaN(count) ? 'unknown' : count}` : `status ${tableResponse.status}`,
    },
  };
}

async function main() {
  const program = new Command();
  program
    .option('--api <url>', 'Vercel deployment base URL (e.g. https://app-tracker.vercel.app)')
    .option('--supabase-url <url>', 'Supabase project URL (https://xyz.supabase.co)')
    .option('--supabase-key <key>', 'Supabase anon key for health checks')
    .parse(process.argv);

  const options = program.opts();
  const apiBaseRaw = options.api ?? process.env.HEALTHCHECK_API;
  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = options.supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiBaseRaw) {
    throw new Error('Provide --api or set HEALTHCHECK_API with the production URL.');
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Provide --supabase-url/--supabase-key or set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  const apiBase = apiBaseRaw.replace(/\/$/, '');

  console.log('🔍 Supabase + Vercel stack health check');
  const checks = await Promise.all([
    checkApi(apiBase),
    checkFrontend(apiBase),
    checkSupabase({ url: supabaseUrl, anonKey: supabaseKey }),
  ]);

  let allOk = true;
  checks.forEach((check) => {
    const icon = check.ok ? '✅' : '❌';
    console.log(`${icon} ${check.name}:`, check.details);
    if (!check.ok) {
      allOk = false;
    }
  });

  if (!allOk) {
    console.error('\n❌ One or more services are unhealthy. Investigate before proceeding.');
    process.exit(1);
  }

  console.log('\n🎉 All services responded with healthy status.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Health check failed:', error.message ?? error);
    process.exit(1);
  });
}

module.exports = { checkApi, checkFrontend, checkSupabase };

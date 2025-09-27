#!/usr/bin/env node
'use strict';

/**
 * Supabase / Vercel Production Data Import Script
 *
 * Wraps the spreadsheet importer so we can perform a dry run or live import
 * against the deployed Next.js API hosted on Vercel.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Command } = require('commander');

const DEFAULT_SPREADSHEET = '/Users/razbugoi/master-applications-tracker/ApplicationsTrackerMaster.xlsm';

async function pingApi(apiBase) {
  const url = new URL('/api/health', apiBase);
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json().catch(() => ({}));
}

function runImporter({ apiBase, spreadsheet, dryRun, token }) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'import-applications.js');
    const args = ['--file', spreadsheet, '--api', apiBase];
    if (dryRun) {
      args.push('--dry-run');
    }
    if (token) {
      args.push('--token', token);
    }

    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_BYPASS_AUTH: 'true',
      },
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`import-applications exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const program = new Command();
  program
    .requiredOption('--api <url>', 'Base URL of deployed Next.js app (e.g. https://app-tracker.vercel.app)')
    .option('--file <path>', 'Spreadsheet to import', DEFAULT_SPREADSHEET)
    .option('--token <jwt>', 'Optional bearer token if production API requires auth')
    .option('--skip-health-check', 'Skip calling the /api/health endpoint before import', false)
    .option('--dry-run', 'Preview the payload without mutating Supabase', false)
    .parse(process.argv);

  const options = program.opts();
  const apiBase = options.api.replace(/\/$/, '');
  const spreadsheet = path.resolve(options.file);

  if (!fs.existsSync(spreadsheet)) {
    throw new Error(`Spreadsheet not found: ${spreadsheet}`);
  }

  console.log('🚀 Production Supabase import');
  console.log(`   Spreadsheet: ${spreadsheet}`);
  console.log(`   API base   : ${apiBase}`);
  console.log(`   Mode       : ${options.dryRun ? 'DRY RUN (no writes)' : 'LIVE IMPORT'}`);

  if (!options.skipHealthCheck) {
    console.log('🔍 Running API health check…');
    await pingApi(apiBase);
    console.log('✅ API health check passed');
  }

  if (options.dryRun) {
    console.log('🔍 Executing dry run using import-applications.js…');
  } else {
    console.log('📥 Executing live import using import-applications.js…');
  }

  await runImporter({
    apiBase,
    spreadsheet,
    dryRun: options.dryRun,
    token: options.token,
  });

  console.log('🎉 Import routine completed successfully.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Production import failed:', error.message ?? error);
    process.exit(1);
  });
}

module.exports = { runImporter, pingApi };

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const args = parseArgs(process.argv.slice(2));

if (!args.file) {
  console.error('Usage: node import-applications.js --file <path-to-xlsm> [--api <api-base-url>] [--token <jwt>] [--dry-run]');
  process.exit(1);
}

const councilPortalMap = loadCouncilPortals();

const workbookPath = path.resolve(process.cwd(), args.file);
if (!fs.existsSync(workbookPath)) {
  console.error(`Spreadsheet not found: ${workbookPath}`);
  process.exit(1);
}

const apiBase = args.api ? String(args.api).replace(/\/?$/, '') : null;
const authToken = args.token ? String(args.token) : null;
const dryRun = Boolean(args['dry-run'] || args.dryRun);

const workbook = xlsx.readFile(workbookPath, {
  cellDates: true,
  cellNF: false,
  cellText: false,
});

const sheetOrder = [
  { name: 'DeterminedApplications', builder: buildDetermined },
  { name: 'LiveApplications', builder: buildLive },
  { name: 'SubmittedApplications', builder: buildSubmitted },
];

const seen = new Set();
const records = [];
const skipped = [];

for (const sheetMeta of sheetOrder) {
  const sheet = workbook.Sheets[sheetMeta.name];
  if (!sheet) {
    console.warn(`Sheet not found: ${sheetMeta.name}`);
    continue;
  }
  const rows = xlsx.utils.sheet_to_json(sheet, {
    defval: '',
    raw: true,
  });
  rows.forEach((row, index) => {
    const context = { sheet: sheetMeta.name, row: index + 2 };
    const result = sheetMeta.builder(row, context);
    if (!result) {
      return;
    }
    if (result.skip) {
      skipped.push({ ...context, reason: result.reason });
      return;
    }
    if (seen.has(result.key)) {
      skipped.push({ ...context, reason: 'duplicate ppReference' });
      return;
    }
    seen.add(result.key);
    records.push(result);
  });
}

(async () => {
  if (!records.length) {
    console.log('No application rows discovered.');
    process.exit(0);
  }

  console.log(`Prepared ${records.length} application payloads (${skipped.length} skipped).`);

  if (!apiBase || dryRun) {
    console.log(dryRun ? 'Dry run enabled; not calling API.' : 'No API base provided; printing payload preview.');
    records.slice(0, 5).forEach((record) => {
      console.log(`\n[${record.sheet}] ${record.key}`);
      console.log('POST', record.create);
      if (record.patch) {
        console.log('PATCH', record.patch);
      }
    });
    if (records.length > 5) {
      console.log(`...and ${records.length - 5} more records.`);
    }
    reportSkipped();
    process.exit(0);
  }

  let created = 0;
  let patched = 0;
  for (const record of records) {
    try {
      const createdApplication = await createApplication(record);
      created += 1;
      if (record.patch) {
        const patchApplied = await patchApplication(createdApplication.applicationId, record.patch);
        if (patchApplied) {
          patched += 1;
        }
      }
      console.log(`Imported ${record.key} (${record.sheet})`);
    } catch (error) {
      console.error(`Failed to import ${record.key} (${record.sheet}): ${error.message}`);
      skipped.push({ sheet: record.sheet, row: record.row, reason: error.message });
    }
  }

  console.log(`\nImport complete: ${created} created, ${patched} patched, ${skipped.length} skipped.`);
  reportSkipped();
})();

function reportSkipped() {
  if (!skipped.length) {
    return;
  }
  console.log('\nSkipped rows:');
  skipped.forEach((item) => {
    console.log(`- ${item.sheet} row ${item.row}: ${item.reason}`);
  });
}

async function createApplication(record) {
  const response = await fetch(`${apiBase}/applications`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(record.create),
  });
  if (!response.ok) {
    const text = await safeText(response);
    throw new Error(`POST ${response.status} ${response.statusText} ${text ? `- ${text}` : ''}`.trim());
  }
  return response.json();
}

async function patchApplication(applicationId, payload) {
  const response = await fetch(`${apiBase}/applications/${applicationId}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (response.status === 204) {
    return true;
  }
  if (!response.ok) {
    const text = await safeText(response);
    throw new Error(`PATCH ${response.status} ${response.statusText} ${text ? `- ${text}` : ''}`.trim());
  }
  return true;
}

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
  }
  return headers;
}

function buildSubmitted(row, context) {
  const prjCodeName = normalizeText(row['PRJ Code and Name']);
  const ppReference = normalizeText(row['PP reference']) || normalizeText(row['Application ref.']);
  const description = normalizeText(row['Description of development']);
  const council = normalizeText(row['Council']);
  const submissionDate = toISODate(row['Submission date']) || toISODate(row['Validation date']);

  if (!prjCodeName || !ppReference || !description || !council || !submissionDate) {
   return skip('missing required fields');
  }

  const create = pickDefined({
    prjCodeName,
    ppReference,
    lpaReference: normalizeText(row['LPA reference']),
    description,
    council,
    submissionDate,
    planningPortalUrl: getPlanningPortalUrl(council),
    notes: normalizeText(row['Notes']),
  });

  return {
    key: ppReference,
    sheet: context.sheet,
    row: context.row,
    create,
    patch: null,
  };
}

function buildLive(row, context) {
  if (process.env.DEBUG_IMPORT === 'true') {
    console.log('Live row raw', context.row, row);
  }
  const base = buildBaseRow(row, {
    requireValidation: true,
    sheet: context.sheet,
    row: context.row,
  });
  if (base.skip) {
    return base;
  }

  const create = pickDefined({
    prjCodeName: base.prjCodeName,
    ppReference: base.ppReference,
    lpaReference: base.lpaReference,
    description: base.description,
    council: base.council,
    submissionDate: base.submissionDate,
    validationDate: base.validationDate,
    caseOfficer: base.caseOfficer,
    determinationDate: base.determinationDate,
    eotDate: base.eotDate,
    planningPortalUrl: base.planningPortalUrl,
  });

  return {
    key: base.ppReference,
    sheet: context.sheet,
    row: context.row,
    create,
    patch: null,
  };
}

function buildDetermined(row, context) {
  const base = buildBaseRow(row, {
    requireValidation: true,
    sheet: context.sheet,
    row: context.row,
  });
  if (base.skip) {
    return base;
  }

  const outcome = normalizeText(row['Outcome']);
  const determinationDate = toISODate(row['Determination date']);

  if (!outcome || !determinationDate) {
    return skip('missing outcome or determination date');
  }

  const create = pickDefined({
    prjCodeName: base.prjCodeName,
    ppReference: base.ppReference,
    lpaReference: base.lpaReference,
    description: base.description,
    council: base.council,
    submissionDate: base.submissionDate,
    validationDate: base.validationDate,
    caseOfficer: base.caseOfficer,
    determinationDate: base.determinationDate,
    eotDate: base.eotDate,
    planningPortalUrl: base.planningPortalUrl,
  });

  const patch = pickDefined({
    status: 'Determined',
    outcome,
    determinationDate,
    eotDate: base.eotDate,
    caseOfficer: base.caseOfficer,
  });

  return {
    key: base.ppReference,
    sheet: context.sheet,
    row: context.row,
    create,
    patch,
  };
}

function buildBaseRow(row, options) {
  const prjCodeName = normalizeText(row['PRJ Code and Name']);
  const ppReference = normalizeText(row['PP reference']) || normalizeText(row['Application ref.']);
  const description = normalizeText(row['Description of development']);
  const council = normalizeText(row['Council']);
  const submissionDate = toISODate(row['Submission date']) || toISODate(row['Validation date']);

  if (!prjCodeName || !ppReference || !description || !council || !submissionDate) {
    return {
      skip: true,
      reason: `missing required fields (${JSON.stringify({ prjCodeName, ppReference, description, council, submissionDate })})`,
    };
  }

  const validationDate = toISODate(row['Validation date']);
  if (options.requireValidation && !validationDate) {
    return skip('missing validation date');
  }

  return {
    prjCodeName,
    ppReference,
    lpaReference: normalizeText(row['Application ref.']) || normalizeText(row['LPA reference']),
    description,
    council,
    submissionDate,
    validationDate,
    caseOfficer: normalizeText(row['Case officer']),
    determinationDate: toISODate(row['Determination date']),
    eotDate: toISODate(row['EOT']),
    planningPortalUrl: getPlanningPortalUrl(council),
    skip: false,
  };
}

function loadCouncilPortals() {
  try {
    const configPath = path.resolve(__dirname, '../config/council-portals.json');
    const contents = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    console.warn('No council portal config found or failed to parse. Portals will need manual entry.', error?.message ?? error);
    return {};
  }
}

function getPlanningPortalUrl(council) {
  if (!council) {
    return undefined;
  }
  const trimmed = council.trim();
  if (trimmed && councilPortalMap[trimmed]) {
    return councilPortalMap[trimmed];
  }
  return undefined;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const str = String(value).trim();
  if (!str) {
    return undefined;
  }
  const lowered = str.toLowerCase();
  if (['n/a', 'none', 'na', '-', 'null'].includes(lowered)) {
    return undefined;
  }
  return str;
}

function toISODate(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const date = xlsx.SSF.parse_date_code(value);
    if (date) {
      const iso = new Date(Date.UTC(date.y, (date.m || 1) - 1, date.d || 1)).toISOString();
      return iso.slice(0, 10);
    }
  }
  const str = String(value).trim();
  if (!str) {
    return undefined;
  }
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(str)) {
    const parts = str.split(/[\/\-]/).map((part) => parseInt(part, 10));
    let [day, month, year] = parts;
    if (str.includes('-') && str.split('-')[0].length === 4) {
      [year, month, day] = parts;
    }
    if (year < 100) {
      year += 2000;
    }
    const iso = new Date(Date.UTC(year, (month || 1) - 1, day || 1)).toISOString();
    return iso.slice(0, 10);
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return undefined;
}

function skip(reason) {
  return { skip: true, reason };
}

function pickDefined(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) {
      continue;
    }
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (error) {
    return '';
  }
}

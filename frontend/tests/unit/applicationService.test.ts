import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Application, Issue } from '../../src/server/models/application';

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'service-role-key';

const serviceModule = await import('../../src/server/services/applicationService');
const { shouldAutoPromoteToLive } = serviceModule;

const routeModule = await import('../../src/app/api/applications/utils');
const { normalise } = routeModule;

function buildApplication(overrides: Partial<Application> = {}): Application {
  return {
    applicationId: 'app-1',
    teamId: 'team-1',
    createdBy: 'user-1',
    prjCodeName: 'Project One',
    ppReference: 'PP/123',
    lpaReference: null,
    description: 'Sample description',
    council: 'Sample Council',
    submissionDate: '2024-01-01',
    validationDate: '2024-01-10',
    caseOfficer: null,
    caseOfficerEmail: null,
    determinationDate: null,
    eotDate: null,
    status: 'Submitted',
    outcome: 'Pending',
    planningPortalUrl: null,
    notes: null,
    issuesCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    issueId: 'issue-1',
    applicationId: 'app-1',
    ppReference: 'PP/123',
    lpaReference: null,
    prjCodeName: 'Project One',
    title: 'Missing document',
    category: 'Documentation',
    description: 'Provide additional paperwork',
    raisedBy: null,
    dateRaised: '2024-01-05',
    assignedTo: null,
    status: 'Open',
    dueDate: null,
    resolutionNotes: null,
    dateResolved: null,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
    ...overrides,
  };
}

describe('shouldAutoPromoteToLive', () => {
  it('returns true when determination date is added and there are no unresolved issues', () => {
    const application = buildApplication();
    const updates = { determinationDate: '2024-02-20' };
    assert.equal(shouldAutoPromoteToLive(application, [], updates), true);
  });

  it('returns false when unresolved issues remain', () => {
    const application = buildApplication();
    const unresolvedIssues = [buildIssue()];
    const updates = { determinationDate: '2024-02-20' };
    assert.equal(shouldAutoPromoteToLive(application, unresolvedIssues, updates), false);
  });

  it('returns false when validation date is absent', () => {
    const application = buildApplication({ validationDate: null });
    const updates = { determinationDate: '2024-02-20' };
    assert.equal(shouldAutoPromoteToLive(application, [], updates), false);
  });
});

describe('normalise', () => {
  it('trims non-empty strings', () => {
    assert.equal(normalise('  hello  '), 'hello');
  });

  it('returns null for blank strings', () => {
    assert.equal(normalise('   '), null);
  });

  it('returns null for explicit null', () => {
    assert.equal(normalise(null), null);
  });

  it('returns undefined for undefined input', () => {
    assert.equal(normalise(undefined), undefined);
  });
});

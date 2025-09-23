'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent, ChangeEvent } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import useSWR, { useSWRConfig } from 'swr';
import {
  createExtension,
  createIssue,
  fetchApplication,
  updateApplication,
  updateIssue,
  type ApplicationAggregateDto,
} from '@/lib/api';

interface Props {
  applicationId: string;
  onClose?: () => void;
}

const statuses = ['Submitted', 'Invalidated', 'Live', 'Determined'] as const;

const issueCategories = ['Validation', 'Technical', 'Design', 'Documentation', 'Other'];

const emptyIssue = {
  title: '',
  category: 'Validation',
  description: '',
  dueDate: '',
  assignedTo: '',
  raisedBy: '',
  dateRaised: new Date().toISOString().slice(0, 10),
};

const emptyExtension = {
  requestedDate: '',
  agreedDate: '',
  notes: '',
};

type CoreDraft = {
  prjCodeName: string;
  ppReference: string;
  lpaReference?: string;
  description: string;
  council: string;
  submissionDate: string;
  validationDate?: string;
  determinationDate?: string;
  outcome?: string;
  caseOfficer?: string;
  caseOfficerEmail?: string;
  planningPortalUrl?: string;
  notes?: string;
};

const OUTCOME_OPTIONS = ['Approved', 'Refused', 'Withdrawn', 'Pending', 'NotApplicable'] as const;

export function ApplicationDetailPanel({ applicationId, onClose }: Props) {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<ApplicationAggregateDto>(
    ['application', applicationId],
    () => fetchApplication(applicationId)
  );
  const [issueForm, setIssueForm] = useState(emptyIssue);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const [extensionForm, setExtensionForm] = useState(emptyExtension);
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [coreDraft, setCoreDraft] = useState<CoreDraft | null>(null);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [coreSaving, setCoreSaving] = useState(false);


  useEffect(() => {
    setCoreDraft(null);
  }, [applicationId]);

  async function handleCreateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) {
      return;
    }
    setIssueError(null);
    try {
      await createIssue(data.application.applicationId, {
        ...issueForm,
        ppReference: data.application.ppReference,
        lpaReference: data.application.lpaReference,
      });
      setIssueForm(emptyIssue);
      await mutate();
      await refreshColumns();
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : 'Failed to create issue');
    }
  }

  async function handleResolveIssue(issueId: string) {
    const resolutionNotes = window.prompt('Provide resolution notes');
    if (!resolutionNotes) {
      return;
    }
    try {
      await updateIssue(applicationId, issueId, {
        status: 'Resolved',
        resolutionNotes,
        dateResolved: new Date().toISOString().slice(0, 10),
      });
      await mutate();
      await refreshColumns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve issue');
    }
  }

  async function handleTransition(targetStatus: (typeof statuses)[number]) {
    if (!data) {
      return;
    }
    setTransitionMessage(null);
    const payload: Record<string, unknown> = { status: targetStatus };
    if (targetStatus === 'Live' && !data.application.validationDate) {
      payload.validationDate = new Date().toISOString().slice(0, 10);
    }
    if (targetStatus === 'Determined') {
      const outcome = window.prompt('Decision outcome (Approved / Refused / Withdrawn / Pending)');
      const determinationDate = window.prompt('Determination date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
      if (!outcome || !determinationDate) {
        return;
      }
      payload.outcome = outcome;
      payload.determinationDate = determinationDate;
    }
    try {
      await updateApplication(applicationId, payload);
      await mutate();
      await refreshColumns();
      setTransitionMessage(`Updated status to ${targetStatus}`);
    } catch (err) {
      setTransitionMessage(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleCreateExtension(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || data.application.status !== 'Live') {
      return;
    }
    setExtensionError(null);
    try {
      if (!extensionForm.agreedDate) {
        throw new Error('Agreed date is required');
      }
      await createExtension(applicationId, {
        agreedDate: extensionForm.agreedDate,
        requestedDate: extensionForm.requestedDate || undefined,
        notes: extensionForm.notes || undefined,
      });
      setExtensionForm(emptyExtension);
      await mutate();
      await refreshColumns();
    } catch (error) {
      setExtensionError(error instanceof Error ? error.message : 'Failed to record extension');
    }
  }

  async function refreshColumns() {
    const applicationMutations = statuses.map((status) => globalMutate(['applications', status]));
    const issuesMutation = globalMutate((key) => Array.isArray(key) && key[0] === 'issues');
    const extensionMutation = globalMutate(['application', applicationId]);
    await Promise.all([...applicationMutations, issuesMutation, extensionMutation]);
  }

  const editingCore = coreDraft !== null;

  function startEditingCore() {
    if (!data) {
      return;
    }
    setCoreError(null);
    setCoreDraft({
      prjCodeName: data.application.prjCodeName,
      ppReference: data.application.ppReference,
      lpaReference: data.application.lpaReference,
      description: data.application.description,
      council: data.application.council,
      submissionDate: data.application.submissionDate,
      validationDate: data.application.validationDate ?? '',
      determinationDate: data.application.determinationDate ?? '',
      outcome: data.application.outcome ?? 'Pending',
      caseOfficer: data.application.caseOfficer ?? '',
      caseOfficerEmail: data.application.caseOfficerEmail ?? '',
      planningPortalUrl: data.application.planningPortalUrl ?? '',
      notes: data.application.notes ?? '',
    });
  }

  function updateCoreDraft(field: keyof CoreDraft, value: string) {
    setCoreDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function cancelEditingCore() {
    setCoreDraft(null);
    setCoreError(null);
    setCoreSaving(false);
  }

  async function saveCoreDraft() {
    if (!data || !coreDraft) {
      return;
    }
    setCoreSaving(true);
    setCoreError(null);
    try {
      const payload: Record<string, unknown> = {};
      const current = data.application;

      const assign = (
        key: keyof CoreDraft,
        transform?: (value: string) => string | null | undefined,
        required = false
      ) => {
        const nextRaw = coreDraft[key];
        const nextValue = typeof transform === 'function' ? transform(nextRaw ?? '') : nextRaw;
        const normalized = typeof nextValue === 'string' ? nextValue.trim() : nextValue;

        if (required && !normalized) {
          throw new Error('Please fill all required fields before saving.');
        }

        const currentValue = (current as unknown as Record<string, unknown>)[key];
        const comparableCurrent = typeof currentValue === 'string' ? currentValue?.toString() : currentValue;
        const comparableNext = normalized === '' ? '' : normalized;

        if ((comparableNext ?? null) !== (comparableCurrent ?? null)) {
          payload[key] = normalized === '' ? null : normalized;
        }
      };

      assign('prjCodeName', undefined, true);
      assign('ppReference', undefined, true);
      assign('lpaReference');
      assign('description', undefined, true);
      assign('council', undefined, true);
      assign('submissionDate', undefined, true);
      assign('validationDate');
      assign('determinationDate');
      assign('outcome');
      assign('caseOfficer');
      assign('caseOfficerEmail');
      assign('planningPortalUrl');
      assign('notes');

      if (Object.keys(payload).length === 0) {
        cancelEditingCore();
        return;
      }

      await updateApplication(applicationId, payload);
      await mutate();
      await refreshColumns();
      cancelEditingCore();
    } catch (error) {
      setCoreError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setCoreSaving(false);
    }
  }

  const timelineSegments = useMemo(() => {
    if (!data || !data.timeline || data.timeline.length === 0) {
      return [];
    }
    const sorted = [...data.timeline].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const segments = sorted.map((event, index) => {
      const startDate = new Date(event.timestamp);
      const next = sorted[index + 1];
      const endDate = next ? new Date(next.timestamp) : new Date();
      const rawDuration = differenceInCalendarDays(endDate, startDate);
      const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 1;
      return {
        ...event,
        startDate,
        endDate,
        duration,
      };
    });
    const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0) || segments.length;
    return segments.map((segment) => ({
      ...segment,
      widthPercent: Math.max((segment.duration / totalDuration) * 100, 12),
    }));
  }, [data?.timeline]);

  if (isLoading) {
    return (
      <div style={panelStyle}>
        <p>Loading application…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={panelStyle}>
        <p style={{ color: 'var(--danger)' }}>Unable to load application</p>
        {onClose && (
          <button type="button" style={secondaryButton} onClick={onClose}>
            Close
          </button>
        )}
      </div>
    );
  }

  const extensions = data.extensions ?? [];
  const isLive = data.application.status === 'Live';

  return (
    <div style={panelStyle}>
      <header style={panelHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={panelSubtitle}>{data.application.ppReference}</span>
          <h2 style={{ margin: 0 }}>{data.application.prjCodeName}</h2>
          <p style={{ margin: '4px 0', color: 'var(--text-muted)' }}>{data.application.description}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <div style={badge(stageColorBadge(data.application.status))}>{data.application.status}</div>
          {onClose && (
            <button type="button" style={secondaryButton} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </header>

      <section style={sectionStyle}>
        <div style={sectionHeaderRow}>
          <h3 style={sectionTitle}>Key Details</h3>
          {editingCore ? (
            <div style={coreActions}>
              <button type="button" style={secondaryButton} onClick={cancelEditingCore} disabled={coreSaving}>
                Cancel
              </button>
              <button type="button" style={primaryButton} onClick={saveCoreDraft} disabled={coreSaving}>
                {coreSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <button type="button" style={primaryButton} onClick={startEditingCore}>
              Edit Details
            </button>
          )}
        </div>
        {coreError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{coreError}</p>}
        {editingCore ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveCoreDraft();
            }}
            style={coreFormStyle}
          >
            <div style={coreFormGrid}>
              <label style={labelStyle}>
                Project Code & Name
                <input
                  required
                  value={coreDraft?.prjCodeName ?? ''}
                  onChange={(event) => updateCoreDraft('prjCodeName', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                PP Reference
                <input
                  required
                  value={coreDraft?.ppReference ?? ''}
                  onChange={(event) => updateCoreDraft('ppReference', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                LPA Reference
                <input
                  value={coreDraft?.lpaReference ?? ''}
                  onChange={(event) => updateCoreDraft('lpaReference', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Council
                <input
                  required
                  value={coreDraft?.council ?? ''}
                  onChange={(event) => updateCoreDraft('council', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Submission Date
                <input
                  required
                  type="date"
                  value={coreDraft?.submissionDate ?? ''}
                  onChange={(event) => updateCoreDraft('submissionDate', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Validation Date
                <input
                  type="date"
                  value={coreDraft?.validationDate ?? ''}
                  onChange={(event) => updateCoreDraft('validationDate', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Determination Date
                <input
                  type="date"
                  value={coreDraft?.determinationDate ?? ''}
                  onChange={(event) => updateCoreDraft('determinationDate', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Outcome
                <select
                  value={coreDraft?.outcome ?? 'Pending'}
                  onChange={(event) => updateCoreDraft('outcome', event.target.value)}
                  style={inputStyle}
                >
                  {OUTCOME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Case Officer
                <input
                  value={coreDraft?.caseOfficer ?? ''}
                  onChange={(event) => updateCoreDraft('caseOfficer', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Case Officer Email
                <input
                  type="email"
                  value={coreDraft?.caseOfficerEmail ?? ''}
                  onChange={(event) => updateCoreDraft('caseOfficerEmail', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Planning Portal URL
                <input
                  value={coreDraft?.planningPortalUrl ?? ''}
                  onChange={(event) => updateCoreDraft('planningPortalUrl', event.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
            <label style={labelStyle}>
              Description
              <textarea
                required
                value={coreDraft?.description ?? ''}
                onChange={(event) => updateCoreDraft('description', event.target.value)}
                style={{ ...inputStyle, minHeight: 120 }}
              />
            </label>
            <label style={labelStyle}>
              Notes
              <textarea
                value={coreDraft?.notes ?? ''}
                onChange={(event) => updateCoreDraft('notes', event.target.value)}
                style={{ ...inputStyle, minHeight: 80 }}
              />
            </label>
            <div style={coreButtons}>
              <button type="button" style={secondaryButton} onClick={cancelEditingCore} disabled={coreSaving}>
                Cancel
              </button>
              <button type="submit" style={primaryButton} disabled={coreSaving}>
                {coreSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl style={detailGrid}>
            <dt>PP Reference</dt>
            <dd>{data.application.ppReference}</dd>
            <dt>LPA Reference</dt>
            <dd>{data.application.lpaReference ?? '—'}</dd>
            <dt>Council</dt>
            <dd>{data.application.council}</dd>
            <dt>Planning Portal</dt>
            <dd>
              {data.application.planningPortalUrl ? (
                <a href={data.application.planningPortalUrl} target="_blank" rel="noopener noreferrer">
                  {data.application.planningPortalUrl}
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Not set</span>
              )}
            </dd>
            <dt>Submission Date</dt>
            <dd>{formatDate(data.application.submissionDate)}</dd>
            <dt>Validation Date</dt>
            <dd>{formatDate(data.application.validationDate)}</dd>
            <dt>Determination Date</dt>
            <dd>{formatDate(data.application.determinationDate)}</dd>
            <dt>EOT</dt>
            <dd>{formatDate(data.application.eotDate)}</dd>
            <dt>Outcome</dt>
            <dd>{data.application.outcome ?? '—'}</dd>
            <dt>Case Officer</dt>
            <dd>
              {data.application.caseOfficer ? (
                data.application.caseOfficerEmail ? (
                  <a href={`mailto:${data.application.caseOfficerEmail}`}>
                    {data.application.caseOfficer}
                  </a>
                ) : (
                  data.application.caseOfficer
                )
              ) : (
                '—'
              )}
            </dd>
            {data.application.notes && (
              <>
                <dt>Notes</dt>
                <dd>{data.application.notes}</dd>
              </>
            )}
          </dl>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitle}>Extensions of Time</h3>
        {data.application.status !== 'Live' && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Extensions can only be added while the application is Live.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {extensions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No extensions recorded.</p>}
          {extensions.map((extension) => (
            <div key={extension.extensionId} style={extensionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{formatDate(extension.agreedDate)}</span>
                {extension.requestedDate && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Requested {formatDate(extension.requestedDate)}</span>
                )}
              </div>
              {extension.notes && <p style={{ margin: '4px 0 0', fontSize: 13 }}>{extension.notes}</p>}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateExtension} style={extensionFormStyle}>
          <h4 style={{ margin: '0 0 8px' }}>Log Extension</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label style={labelStyle}>
              Requested Date
              <input
                type="date"
                value={extensionForm.requestedDate}
                onChange={(event) => setExtensionForm((prev) => ({ ...prev, requestedDate: event.target.value }))}
                style={inputStyle}
                disabled={!isLive}
              />
            </label>
            <label style={labelStyle}>
              Agreed Date
              <input
                required
                type="date"
                value={extensionForm.agreedDate}
                onChange={(event) => setExtensionForm((prev) => ({ ...prev, agreedDate: event.target.value }))}
                style={inputStyle}
                disabled={!isLive}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Notes
            <textarea
              value={extensionForm.notes}
              onChange={(event) => setExtensionForm((prev) => ({ ...prev, notes: event.target.value }))}
              style={{ ...inputStyle, minHeight: 60 }}
              disabled={!isLive}
            />
          </label>
          {extensionError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{extensionError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={primaryButton} disabled={!isLive}>
              Save Extension
            </button>
          </div>
        </form>
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitle}>Status Actions</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={actionButton} onClick={() => handleTransition('Live')}>
            Mark Live
          </button>
          <button type="button" style={actionButton} onClick={() => handleTransition('Invalidated')}>
            Flag Invalidated
          </button>
          <button type="button" style={actionButton} onClick={() => handleTransition('Determined')}>
            Record Decision
          </button>
        </div>
        {transitionMessage && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{transitionMessage}</p>}
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitle}>Issues</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.issues.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No issues logged</p>}
          {data.issues.map((issue) => (
            <div key={issue.issueId} style={issueCard(issue.status)}>
              <header style={issueHeader}>
                <div>
                  <strong>{issue.title}</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{issue.category}</div>
                </div>
                {issue.status !== 'Resolved' && issue.status !== 'Closed' && (
                  <button type="button" style={resolveButton} onClick={() => handleResolveIssue(issue.issueId)}>
                    Resolve
                  </button>
                )}
              </header>
              <p style={{ margin: '6px 0 8px' }}>{issue.description}</p>
              <dl style={issueMeta}>
                <dt>Status</dt>
                <dd>{issue.status}</dd>
                <dt>Due</dt>
                <dd>{formatDate(issue.dueDate)}</dd>
                <dt>Assigned To</dt>
                <dd>{issue.assignedTo ?? '—'}</dd>
                <dt>Raised</dt>
                <dd>{formatDate(issue.dateRaised)}</dd>
                {issue.resolutionNotes && (
                  <>
                    <dt>Resolution</dt>
                    <dd>{issue.resolutionNotes}</dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </div>
        <form onSubmit={handleCreateIssue} style={issueFormStyle}>
          <h4 style={{ margin: 0 }}>Add Issue</h4>
          <label style={labelStyle}>
            Title
            <input required value={issueForm.title} onChange={updateIssueField('title')} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Category
            <select value={issueForm.category} onChange={updateIssueField('category')} style={inputStyle}>
              {issueCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Description
            <textarea required value={issueForm.description} onChange={updateIssueField('description')} style={{ ...inputStyle, minHeight: 80 }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label style={labelStyle}>
              Raised By
              <input value={issueForm.raisedBy} onChange={updateIssueField('raisedBy')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Assigned To
              <input value={issueForm.assignedTo} onChange={updateIssueField('assignedTo')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Date Raised
              <input type="date" value={issueForm.dateRaised} onChange={updateIssueField('dateRaised')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Due Date
              <input type="date" value={issueForm.dueDate} onChange={updateIssueField('dueDate')} style={inputStyle} />
            </label>
          </div>
          {issueError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{issueError}</p>}
          <button type="submit" style={primaryButton}>
            Add Issue
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitle}>Timeline</h3>
        {timelineSegments.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No timeline events recorded.</p>}
        {timelineSegments.length > 0 && (
          <div style={timelineWrapper}>
            <div style={ganttContainer}>
              {timelineSegments.map((segment) => (
                <div
                  key={segment.eventId}
                  style={{
                    ...ganttSegment,
                    background: stageColorBadge(segment.stage),
                    flexGrow: segment.duration,
                    flexBasis: `${segment.widthPercent}%`,
                  }}
                >
                  <span style={ganttLabel}>{segment.event}</span>
                  <span style={ganttDates}>
                    {format(segment.startDate, 'dd MMM yyyy')} → {format(segment.endDate, 'dd MMM yyyy')}
                  </span>
                  {segment.details && <span style={ganttDetails}>{segment.details}</span>}
                </div>
              ))}
            </div>
            <div style={timelineLegend}>
              {timelineSegments.map((segment) => (
                <div key={`${segment.eventId}-legend`} style={legendItem}>
                  <span
                    style={{
                      ...legendDot,
                      background: stageColorBadge(segment.stage),
                    }}
                  />
                  <span>{segment.stage}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );

  function updateIssueField(field: keyof typeof emptyIssue) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setIssueForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }
}

function stageColorBadge(status?: string) {
  switch (status) {
    case 'Submitted':
      return '#6366f1';
    case 'Invalidated':
      return '#f97316';
    case 'Live':
      return '#22c55e';
    case 'Determined':
      return '#0ea5e9';
    default:
      return '#6b7280';
  }
}

function formatDate(value?: string) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString();
  } catch (error) {
    return value;
  }
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  minWidth: 0,
  width: '100%',
};

const panelHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 24,
};

const badge = (background: string): CSSProperties => ({
  display: 'inline-block',
  background,
  color: '#fff',
  borderRadius: 999,
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 6,
});

const sectionStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 16,
};

const sectionHeaderRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
};

const coreActions: CSSProperties = {
  display: 'flex',
  gap: 8,
};

const coreFormStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const coreFormGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const coreButtons: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const panelSubtitle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
};

const detailGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '4px 16px',
  fontSize: 13,
};

const actionButton: CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
  fontWeight: 600,
};

const primaryButton: CSSProperties = {
  background: 'var(--primary-dark)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryButton: CSSProperties = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
};

const issueCard = (status: string): CSSProperties => ({
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
  background:
    status === 'Resolved'
      ? 'rgba(34, 197, 94, 0.08)'
      : status === 'In Progress'
      ? 'rgba(37, 99, 235, 0.08)'
      : 'rgba(248, 250, 252, 0.9)',
});

const issueHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
};

const resolveButton: CSSProperties = {
  background: 'var(--success)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
};

const issueMeta: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '4px 12px',
  fontSize: 12,
  color: 'var(--text-muted)',
};

const issueFormStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
  marginTop: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'var(--surface)',
};

const extensionFormStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
  marginTop: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  background: 'var(--surface)',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: 'var(--text-muted)',
};

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 14,
};

const timelineWrapper: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const ganttContainer: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'stretch',
  minHeight: 120,
};

const ganttSegment: CSSProperties = {
  borderRadius: 16,
  color: '#fff',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 140,
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.15)',
};

const ganttLabel: CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
};

const ganttDates: CSSProperties = {
  fontSize: 12,
  opacity: 0.9,
};

const ganttDetails: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
  opacity: 0.9,
};

const timelineLegend: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
};

const legendItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: 'var(--text-muted)',
};

const legendDot: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
};

const extensionCard: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
  background: 'rgba(248, 250, 252, 0.9)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, FormEvent, ChangeEvent } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  createIssue,
  fetchApplication,
  updateApplication,
  updateIssue,
  type ApplicationAggregateDto,
} from '@/lib/api';

interface Props {
  applicationId: string;
  onClose: () => void;
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

export function ApplicationDetailPanel({ applicationId, onClose }: Props) {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<ApplicationAggregateDto>(
    ['application', applicationId],
    () => fetchApplication(applicationId)
  );
  const [issueForm, setIssueForm] = useState(emptyIssue);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);

  const stageColor = useMemo(() => stageBadge(data?.application.status), [data?.application.status]);

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

  async function refreshColumns() {
    await Promise.all(statuses.map((status) => globalMutate(['applications', status])));
  }

  if (isLoading) {
    return (
      <aside style={panelStyle}>
        <p>Loading application…</p>
      </aside>
    );
  }

  if (error || !data) {
    return (
      <aside style={panelStyle}>
        <p style={{ color: 'var(--danger)' }}>Unable to load application</p>
        <button type="button" style={secondaryButton} onClick={onClose}>
          Close
        </button>
      </aside>
    );
  }

  return (
    <aside style={panelStyle}>
      <header style={panelHeader}>
        <div>
          <h2 style={{ margin: 0 }}>{data.application.prjCodeName}</h2>
          <p style={{ margin: '4px 0', color: 'var(--text-muted)' }}>{data.application.description}</p>
          <div style={badge(stageColor)}>{data.application.status}</div>
        </div>
        <button type="button" style={secondaryButton} onClick={onClose}>
          Close
        </button>
      </header>

      <section style={sectionStyle}>
        <h3 style={sectionTitle}>Key Details</h3>
        <dl style={detailGrid}>
          <dt>PP Reference</dt>
          <dd>{data.application.ppReference}</dd>
          <dt>LPA Reference</dt>
          <dd>{data.application.lpaReference ?? '—'}</dd>
          <dt>Council</dt>
          <dd>{data.application.council}</dd>
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
          <dd>{data.application.caseOfficer ?? '—'}</dd>
        </dl>
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

      <section style={{ ...sectionStyle, flex: 1, overflowY: 'auto' }}>
        <h3 style={sectionTitle}>Timeline</h3>
        <ul style={timelineList}>
          {data.timeline.map((event) => (
            <li key={event.eventId} style={timelineItem}>
              <div style={timelineDot(stageBadge(event.stage))} />
              <div>
                <div style={{ fontWeight: 600 }}>{event.event}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(event.timestamp)}</div>
                {event.details && <p style={{ margin: '4px 0 0' }}>{event.details}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );

  function updateIssueField(field: keyof typeof emptyIssue) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setIssueForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }
}

function stageBadge(status?: string) {
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
  position: 'fixed',
  top: 0,
  right: 0,
  width: '420px',
  height: '100vh',
  background: 'var(--surface)',
  borderLeft: '1px solid var(--border)',
  boxShadow: '-12px 0 24px rgba(15, 23, 42, 0.08)',
  padding: '20px 24px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  zIndex: 20,
};

const panelHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
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
  borderTop: '1px solid rgba(148, 163, 184, 0.3)',
  paddingTop: 12,
};

const sectionTitle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 16,
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
  marginTop: 8,
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
  background: '#fff',
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

const timelineList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const timelineItem: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
};

const timelineDot = (background: string): CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  background,
  marginTop: 6,
});

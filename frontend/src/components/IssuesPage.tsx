'use client';

import { useState, type CSSProperties } from 'react';
import useSWR from 'swr';
import { listIssues, SWR_KEYS, type IssueDto } from '@/lib/api';
import { LoadingSpinner } from './LoadingSpinner';
import { useAppNavigation } from '@/lib/useAppNavigation';

const FILTERS: { label: string; value: IssueDto['status'] | 'All' }[] = [
  { label: 'All', value: 'All' },
  { label: 'Open', value: 'Open' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Resolved', value: 'Resolved' },
  { label: 'Closed', value: 'Closed' },
];

export function IssuesPage() {
  const [filter, setFilter] = useState<'All' | IssueDto['status']>('All');
  const { data, isLoading, error } = useSWR(
    SWR_KEYS.issues(filter),
    () => listIssues(filter === 'All' ? undefined : filter)
  );
  const { goToApplication } = useAppNavigation();

  const items = data?.items ?? [];

  return (
    <main style={layout}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Issues</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Consolidated view of outstanding and resolved issues across every application.
          </p>
        </div>
        <nav style={filterBar} aria-label="Issue status filter">
          {FILTERS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setFilter(entry.value)}
              style={{
                ...filterButton,
                background: filter === entry.value ? 'var(--primary)' : 'transparent',
                color: filter === entry.value ? '#fff' : 'var(--text)',
                borderColor: filter === entry.value ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      {isLoading && (
        <div style={spinnerWrapper}>
          <LoadingSpinner size="sm" message="Loading issues…" />
        </div>
      )}
      {error && <p style={{ ...messageStyle, color: 'var(--danger)' }}>Failed to load issues.</p>}
      {!isLoading && !error && items.length === 0 && <p style={messageStyle}>No issues recorded.</p>}

      {items.length > 0 && (
        <section className="status-table-wrapper">
          <div className="status-table-scroll">
            <table className="status-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Project</th>
                  <th scope="col">PP Ref</th>
                  <th scope="col">Status</th>
                  <th scope="col">Raised</th>
                  <th scope="col">Due</th>
                  <th scope="col">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {items.map((issue, index) => (
                  <tr
                    key={issue.issueId}
                    onClick={() => goToApplication(issue.applicationId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        goToApplication(issue.applicationId);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    <td className="status-table__cell--index">{index + 1}</td>
                    <td title={issue.title}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>{issue.title}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{issue.category}</span>
                      </div>
                    </td>
                    <td title={issue.prjCodeName ?? '—'}>{issue.prjCodeName ?? '—'}</td>
                    <td title={issue.ppReference}>{issue.ppReference}</td>
                    <td>{issue.status}</td>
                    <td>{formatDate(issue.dateRaised)}</td>
                    <td>{formatDate(issue.dueDate)}</td>
                    <td>{issue.assignedTo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

const layout: CSSProperties = {
  maxWidth: 1024,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const filterBar: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
};

const filterButton: CSSProperties = {
  borderRadius: 999,
  border: '1px solid var(--border)',
  padding: '8px 14px',
  fontWeight: 600,
  cursor: 'pointer',
  background: 'transparent',
};

const messageStyle: CSSProperties = {
  padding: 48,
  textAlign: 'center',
  color: 'var(--text-muted)',
};

const spinnerWrapper: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: 32,
};

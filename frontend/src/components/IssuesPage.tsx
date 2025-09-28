'use client';

import { useState, type CSSProperties } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { deleteIssue, listIssues, SWR_KEYS, type IssueDto } from '@/lib/api';
import { refreshApplicationCaches, removeIssueFromCaches } from '@/lib/applicationCache';
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
  const { mutate: globalMutate } = useSWRConfig();
  const [filter, setFilter] = useState<'All' | IssueDto['status']>('All');
  const { data, isLoading, error, mutate } = useSWR(
    SWR_KEYS.issues(filter),
    () => listIssues(filter === 'All' ? undefined : filter)
  );
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const { goToApplication } = useAppNavigation();

  const items = data?.items ?? [];

  async function handleDelete(issue: IssueDto) {
    const confirmed = window.confirm(`Delete issue "${issue.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setDeletingIssueId(issue.issueId);
    try {
      await deleteIssue(issue.applicationId, issue.issueId);
      await removeIssueFromCaches(globalMutate, issue);
      await Promise.all([
        refreshApplicationCaches(globalMutate, issue.applicationId),
        globalMutate(SWR_KEYS.dashboardOverview),
      ]);
      await mutate();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to delete issue');
    } finally {
      setDeletingIssueId(null);
    }
  }

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
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((issue, index) => (
                  <tr
                    key={issue.issueId}
                    onClick={() => goToApplication(issue.applicationId, 'issues', { issueId: issue.issueId })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        goToApplication(issue.applicationId, 'issues', { issueId: issue.issueId });
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
                    <td>
                      <div style={actionsCell}>
                        <button
                          type="button"
                          style={actionButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            goToApplication(issue.applicationId, 'issues', { issueId: issue.issueId });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={dangerActionButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(issue);
                          }}
                          disabled={deletingIssueId === issue.issueId}
                        >
                          {deletingIssueId === issue.issueId ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
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

const actionsCell: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const actionButton: CSSProperties = {
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'transparent',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const dangerActionButton: CSSProperties = {
  ...actionButton,
  borderColor: 'var(--danger)',
  color: 'var(--danger)',
};

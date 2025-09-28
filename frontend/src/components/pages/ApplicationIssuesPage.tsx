'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useSWRConfig } from 'swr';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useNavigation, buildBreadcrumbs } from '@/contexts/NavigationContext';
import { createIssue, deleteIssue, fetchApplication, SWR_KEYS, updateIssue, type ApplicationAggregateDto } from '@/lib/api';
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from '@/lib/applicationConstants';
import { mergeIssueIntoCaches, refreshApplicationCaches, removeIssueFromCaches } from '@/lib/applicationCache';
import { useAppNavigation } from '@/lib/useAppNavigation';
import type { IssueDto, IssueStatus } from '@/types/application';

interface Props {
  applicationId: string;
}

interface IssueDraft {
  title: string;
  category: string;
  description: string;
  dueDate: string;
  assignedTo: string;
  raisedBy: string;
  dateRaised: string;
}

function emptyIssueDraft(): IssueDraft {
  return {
    title: '',
    category: ISSUE_CATEGORIES[0],
    description: '',
    dueDate: '',
    assignedTo: '',
    raisedBy: '',
    dateRaised: new Date().toISOString().slice(0, 10),
  };
}

interface IssueEditDraft {
  issueId: string;
  title: string;
  category: string;
  description: string;
  dueDate: string;
  assignedTo: string;
  raisedBy: string;
  dateRaised: string;
  status: IssueStatus;
  resolutionNotes: string;
  dateResolved: string;
}

function issueToEditDraft(issue: IssueDto): IssueEditDraft {
  const normaliseDate = (value?: string | null) => (value ? value.slice(0, 10) : '');
  return {
    issueId: issue.issueId,
    title: issue.title,
    category: issue.category,
    description: issue.description,
    dueDate: normaliseDate(issue.dueDate),
    assignedTo: issue.assignedTo ?? '',
    raisedBy: issue.raisedBy ?? '',
    dateRaised: normaliseDate(issue.dateRaised) || new Date().toISOString().slice(0, 10),
    status: issue.status,
    resolutionNotes: issue.resolutionNotes ?? '',
    dateResolved: normaliseDate(issue.dateResolved),
  };
}

export function ApplicationIssuesPage({ applicationId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dispatch } = useNavigation();
  const { goBack } = useAppNavigation();
  const { data, error, isLoading, mutate } = useSWR<ApplicationAggregateDto>(
    SWR_KEYS.applicationAggregate(applicationId),
    () => fetchApplication(applicationId)
  );
  const initialIssueId = searchParams.get('issueId') ?? undefined;

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, [dispatch, isLoading]);

  useEffect(() => {
    if (data) {
      dispatch({ type: 'SET_APPLICATION', payload: data.application });
      const crumbs = buildBreadcrumbs(data.application, pathname);
      dispatch({ type: 'SET_BREADCRUMBS', payload: crumbs });
    }
    if (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
    return () => {
      dispatch({ type: 'SET_BREADCRUMBS', payload: [] });
    };
  }, [dispatch, data, error, pathname]);

  if (isLoading) {
    return (
      <div style={pageShell}>
        <BreadcrumbNav />
        <div style={centered}>
          <LoadingSpinner size="lg" message="Loading issues…" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={pageShell}>
        <BreadcrumbNav />
        <div style={errorCard}>
          <h1 style={{ margin: 0 }}>Unable to load issues</h1>
          <p style={{ margin: '8px 0 16px', color: 'var(--text-muted)' }}>{error?.message ?? 'Unknown error.'}</p>
          <button type="button" style={primaryButton} onClick={goBack}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageShell}>
      <BreadcrumbNav />
      <IssuesLayout
        applicationId={applicationId}
        aggregate={data}
        onUpdated={mutate}
        initialIssueId={initialIssueId}
      />
    </div>
  );
}

interface IssuesLayoutProps {
  applicationId: string;
  aggregate: ApplicationAggregateDto;
  onUpdated: () => Promise<any>;
  initialIssueId?: string;
}

function IssuesLayout({ applicationId, aggregate, onUpdated, initialIssueId }: IssuesLayoutProps) {
  const { mutate: globalMutate } = useSWRConfig();
  const { application } = aggregate;
  const [issueDraft, setIssueDraft] = useState<IssueDraft>(() => emptyIssueDraft());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editDraft, setEditDraft] = useState<IssueEditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const initialIssueAppliedRef = useRef<string | null>(null);
  const issues = aggregate.issues ?? [];

  useEffect(() => {
    setIssueDraft(emptyIssueDraft());
    setEditDraft(null);
    setEditError(null);
    setEditSaving(false);
    setDeletingIssueId(null);
    initialIssueAppliedRef.current = null;
  }, [application.applicationId]);

  const controls = useMemo(() => buildIssueControls(setIssueDraft), []);
  const updateEditDraft = useCallback(<T extends keyof IssueEditDraft>(field: T, value: IssueEditDraft[T]) => {
    setEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  useEffect(() => {
    if (!initialIssueId) {
      initialIssueAppliedRef.current = null;
      return;
    }
    if (initialIssueAppliedRef.current === initialIssueId) {
      return;
    }
    const match = issues.find((issue) => issue.issueId === initialIssueId);
    if (match) {
      setEditDraft(issueToEditDraft(match));
      initialIssueAppliedRef.current = initialIssueId;
    }
  }, [initialIssueId, issues]);

  const editingIssue = useMemo(() => {
    if (!editDraft) {
      return null;
    }
    return issues.find((issue) => issue.issueId === editDraft.issueId) ?? null;
  }, [issues, editDraft]);

  const isEditingIssueDeleting = Boolean(editingIssue && deletingIssueId === editingIssue.issueId);

  async function handleCreateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const createdIssue = await createIssue(applicationId, {
        ppReference: application.ppReference,
        lpaReference: application.lpaReference ?? undefined,
        ...issueDraft,
        dueDate: issueDraft.dueDate || undefined,
        assignedTo: issueDraft.assignedTo || undefined,
        raisedBy: issueDraft.raisedBy || undefined,
      });
      setIssueDraft(emptyIssueDraft());
      await mergeIssueIntoCaches(globalMutate, createdIssue);
      await Promise.all([
        onUpdated(),
        refreshApplicationCaches(globalMutate, applicationId, { includeIssues: false }),
        globalMutate(SWR_KEYS.dashboardOverview),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setSaving(false);
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
      await Promise.all([
        onUpdated(),
        refreshApplicationCaches(globalMutate, applicationId),
        globalMutate(SWR_KEYS.dashboardOverview),
      ]);
      setEditDraft((prev) => (prev?.issueId === issueId ? null : prev));
      setEditError(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to resolve issue');
    }
  }

  async function handleDeleteIssue(issue: IssueDto) {
    const confirmed = window.confirm(`Delete issue "${issue.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setDeletingIssueId(issue.issueId);
    try {
      await deleteIssue(applicationId, issue.issueId);
      await removeIssueFromCaches(globalMutate, issue);
      await Promise.all([
        onUpdated(),
        refreshApplicationCaches(globalMutate, applicationId),
        globalMutate(SWR_KEYS.dashboardOverview),
      ]);
      setEditDraft((prev) => (prev?.issueId === issue.issueId ? null : prev));
      if (initialIssueAppliedRef.current === issue.issueId) {
        initialIssueAppliedRef.current = null;
      }
      setEditError(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete issue');
    } finally {
      setDeletingIssueId(null);
    }
  }

  function handleStartEditing(issue: IssueDto) {
    setEditError(null);
    setEditDraft(issueToEditDraft(issue));
  }

  function handleCancelEdit() {
    setEditDraft(null);
    setEditError(null);
  }

  async function handleUpdateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editDraft) {
      return;
    }

    const title = editDraft.title.trim();
    const description = editDraft.description.trim();
    if (!title) {
      setEditError('Title is required.');
      return;
    }
    if (!description) {
      setEditError('Description is required.');
      return;
    }
    if (!editDraft.dateRaised) {
      setEditError('Date raised is required.');
      return;
    }

    const assignedTo = editDraft.assignedTo.trim();
    const raisedBy = editDraft.raisedBy.trim();
    const resolutionNotes = editDraft.resolutionNotes.trim();
    const dueDate = editDraft.dueDate.trim();
    const dateResolved = editDraft.dateResolved.trim();

    if (editDraft.status === 'Resolved' && !resolutionNotes) {
      setEditError('Resolution notes are required when resolving an issue.');
      return;
    }

    const includeResolutionData = editDraft.status === 'Resolved' || editDraft.status === 'Closed';

    const payload: Record<string, unknown> = {
      title,
      category: editDraft.category,
      description,
      raisedBy: raisedBy || null,
      assignedTo: assignedTo || null,
      status: editDraft.status,
      dateRaised: editDraft.dateRaised,
      dueDate: dueDate || null,
      resolutionNotes: includeResolutionData ? resolutionNotes || null : null,
      dateResolved: includeResolutionData ? dateResolved || null : null,
    };

    if (editDraft.status === 'Resolved' && !payload.dateResolved) {
      payload.dateResolved = new Date().toISOString().slice(0, 10);
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await updateIssue(applicationId, editDraft.issueId, payload);
      await Promise.all([
        onUpdated(),
        refreshApplicationCaches(globalMutate, applicationId),
        globalMutate(SWR_KEYS.dashboardOverview),
      ]);
      setEditDraft(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div style={issuesLayout}>
      <section style={issuesCard}>
        <header style={cardHeader}>
          <div>
            <h1 style={{ margin: 0 }}>Issues</h1>
            <p style={cardSubtitle}>Log validation actions, track owners, and resolve blockers.</p>
          </div>
        </header>
        {issues.length === 0 ? (
          <p style={emptyState}>No issues recorded yet.</p>
        ) : (
          <ul style={issuesList}>
            {issues.map((issue) => {
              const isEditing = editDraft?.issueId === issue.issueId;
              return (
                <li key={issue.issueId} style={{ ...issueRow, outline: isEditing ? '2px solid var(--primary)' : undefined }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={issueTitle}>{issue.title}</span>
                    <span style={issueMeta}>
                      {issue.category} • Raised {formatDate(issue.dateRaised)}
                      {issue.assignedTo ? ` • Assigned to ${issue.assignedTo}` : ''}
                    </span>
                  </div>
                <div style={issueActions}>
                  <span style={statusPill(issue.status)}>{issue.status}</span>
                  <button
                    type="button"
                    style={{ ...linkButton, opacity: isEditing ? 0.6 : 1 }}
                    onClick={() => handleStartEditing(issue)}
                    disabled={deletingIssueId === issue.issueId || (isEditing && editSaving)}
                  >
                    {isEditing ? 'Editing…' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    style={dangerLinkButton}
                    onClick={() => handleDeleteIssue(issue)}
                    disabled={deletingIssueId === issue.issueId}
                  >
                    {deletingIssueId === issue.issueId ? 'Deleting…' : 'Delete'}
                  </button>
                  {issue.status !== 'Resolved' && issue.status !== 'Closed' && (
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={() => handleResolveIssue(issue.issueId)}
                      disabled={deletingIssueId === issue.issueId}
                    >
                      Mark resolved
                    </button>
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={formCard}>
        <h2 style={{ margin: '0 0 12px' }}>{editDraft ? 'Edit issue' : 'Log new issue'}</h2>
        {editDraft ? (
          <form onSubmit={handleUpdateIssue} style={formLayout}>
            <label style={labelStyle}>
              Title
              <input
                required
                value={editDraft.title}
                onChange={(event) => updateEditDraft('title', event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Category
              <select
                value={editDraft.category}
                onChange={(event) => updateEditDraft('category', event.target.value)}
                style={inputStyle}
              >
                {ISSUE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Description
              <textarea
                required
                value={editDraft.description}
                onChange={(event) => updateEditDraft('description', event.target.value)}
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              />
            </label>
            <div style={gridLayout}>
              <label style={labelStyle}>
                Raised by
                <input
                  value={editDraft.raisedBy}
                  onChange={(event) => updateEditDraft('raisedBy', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Assigned to
                <input
                  value={editDraft.assignedTo}
                  onChange={(event) => updateEditDraft('assignedTo', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Date raised
                <input
                  type="date"
                  value={editDraft.dateRaised}
                  onChange={(event) => updateEditDraft('dateRaised', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Due date
                <input
                  type="date"
                  value={editDraft.dueDate}
                  onChange={(event) => updateEditDraft('dueDate', event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Status
                <select
                  value={editDraft.status}
                  onChange={(event) => updateEditDraft('status', event.target.value as IssueStatus)}
                  style={inputStyle}
                >
                  {ISSUE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(editDraft.status === 'Resolved' || editDraft.status === 'Closed') && (
              <>
                <label style={labelStyle}>
                  Date resolved
                  <input
                    type="date"
                    value={editDraft.dateResolved}
                    onChange={(event) => updateEditDraft('dateResolved', event.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Resolution notes
                  <textarea
                    value={editDraft.resolutionNotes}
                    onChange={(event) => updateEditDraft('resolutionNotes', event.target.value)}
                    style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
                  />
                </label>
              </>
            )}
            {editError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{editError}</p>}
            <div style={actionsRow}>
              {editingIssue && (
                <button
                  type="button"
                  style={{ ...dangerButton, marginRight: 'auto' }}
                  onClick={() => handleDeleteIssue(editingIssue)}
                  disabled={isEditingIssueDeleting || editSaving}
                >
                  {isEditingIssueDeleting ? 'Deleting…' : 'Delete issue'}
                </button>
              )}
              <button
                type="button"
                style={secondaryButton}
                onClick={handleCancelEdit}
                disabled={editSaving || isEditingIssueDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={primaryButton}
                disabled={editSaving || isEditingIssueDeleting}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateIssue} style={formLayout}>
            <label style={labelStyle}>
              Title
              <input required value={issueDraft.title} onChange={controls.updateText('title')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Category
              <select value={issueDraft.category} onChange={controls.updateSelect('category')} style={inputStyle}>
                {ISSUE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Description
              <textarea
                required
                value={issueDraft.description}
                onChange={controls.updateTextArea('description')}
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              />
            </label>
            <div style={gridLayout}>
              <label style={labelStyle}>
                Raised by
                <input value={issueDraft.raisedBy} onChange={controls.updateText('raisedBy')} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Assigned to
                <input value={issueDraft.assignedTo} onChange={controls.updateText('assignedTo')} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Date raised
                <input type="date" value={issueDraft.dateRaised} onChange={controls.updateText('dateRaised')} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Due date
                <input type="date" value={issueDraft.dueDate} onChange={controls.updateText('dueDate')} style={inputStyle} />
              </label>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
            <div style={actionsRow}>
              <button type="submit" style={primaryButton} disabled={saving}>
                {saving ? 'Saving…' : 'Add issue'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function buildIssueControls(setIssueDraft: (updater: (prev: IssueDraft) => IssueDraft) => void) {
  return {
    updateText:
      (field: keyof IssueDraft) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setIssueDraft((prev) => ({ ...prev, [field]: value }));
      },
    updateSelect:
      (field: keyof IssueDraft) =>
      (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setIssueDraft((prev) => ({ ...prev, [field]: value }));
      },
    updateTextArea:
      (field: keyof IssueDraft) =>
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        const value = event.target.value;
        setIssueDraft((prev) => ({ ...prev, [field]: value }));
      },
  } as const;
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

function statusPill(status: string): CSSProperties {
  const palette: Record<string, string> = {
    Open: '#f97316',
    'In Progress': '#f59e0b',
    Resolved: '#22c55e',
    Closed: '#6b7280',
  };
  const background = palette[status] ?? '#94a3b8';
  return {
    padding: '6px 12px',
    borderRadius: 999,
    background,
    color: '#fff',
    fontWeight: 600,
    fontSize: 12,
  };
}

const pageShell: CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const centered: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '64px 0',
};

const errorCard: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 16,
  background: 'var(--surface)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  alignItems: 'flex-start',
};

const issuesLayout: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 24,
};

const issuesCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const formCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const cardHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
};

const cardSubtitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--text-muted)',
};

const issuesList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const issueRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '16px 20px',
  borderRadius: 12,
  border: '1px solid var(--border-subtle)',
};

const issueTitle: CSSProperties = {
  fontWeight: 600,
  fontSize: 16,
};

const issueMeta: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 13,
};

const issueActions: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const emptyState: CSSProperties = {
  margin: '12px 0 0',
  color: 'var(--text-muted)',
};

const gridLayout: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
};

const formLayout: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: 'var(--text-muted)',
};

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: '10px 12px',
  fontSize: 14,
};

const actionsRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const primaryButton: CSSProperties = {
  background: 'var(--primary)',
  border: 'none',
  color: '#fff',
  borderRadius: 999,
  fontWeight: 600,
  padding: '12px 22px',
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 999,
  fontWeight: 600,
  padding: '10px 18px',
  cursor: 'pointer',
};

const linkButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--primary)',
  borderRadius: 999,
  fontWeight: 600,
  padding: '10px 12px',
  cursor: 'pointer',
};

const dangerButton: CSSProperties = {
  background: 'var(--danger)',
  border: 'none',
  color: '#fff',
  borderRadius: 999,
  fontWeight: 600,
  padding: '10px 18px',
  cursor: 'pointer',
};

const dangerLinkButton: CSSProperties = {
  ...linkButton,
  color: 'var(--danger)',
};

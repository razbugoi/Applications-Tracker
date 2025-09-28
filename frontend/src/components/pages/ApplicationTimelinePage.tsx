'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { differenceInCalendarDays, format } from 'date-fns';
import useSWR, { useSWRConfig } from 'swr';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useNavigation, buildBreadcrumbs } from '@/contexts/NavigationContext';
import {
  fetchApplication,
  createExtension,
  updateExtension,
  SWR_KEYS,
  type ApplicationAggregateDto,
} from '@/lib/api';
import { useAppNavigation } from '@/lib/useAppNavigation';
import { refreshApplicationCaches } from '@/lib/applicationCache';
import type { ExtensionDto } from '@/types/application';

interface Props {
  applicationId: string;
}

interface TimelineSegment {
  eventId: string;
  event: string;
  stage: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  widthPercent: number;
  details?: string | null;
}

type ExtensionFormDraft = {
  requestedDate: string;
  agreedDate: string;
  notes: string;
};

export function ApplicationTimelinePage({ applicationId }: Props) {
  const pathname = usePathname();
  const { dispatch } = useNavigation();
  const { goBack } = useAppNavigation();
  const { data, error, isLoading } = useSWR<ApplicationAggregateDto>(
    SWR_KEYS.applicationAggregate(applicationId),
    () => fetchApplication(applicationId)
  );

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
          <LoadingSpinner size="lg" message="Loading timeline…" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={pageShell}>
        <BreadcrumbNav />
        <div style={errorCard}>
          <h1 style={{ margin: 0 }}>Unable to load timeline</h1>
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
      <TimelineContent aggregate={data} />
      <ExtensionsPanel applicationId={applicationId} aggregate={data} />
    </div>
  );
}

function TimelineContent({ aggregate }: { aggregate: ApplicationAggregateDto }) {
  const segments = useTimelineSegments(aggregate);

  return (
    <section style={timelineCard}>
      <header style={cardHeader}>
        <div>
          <h1 style={{ margin: 0 }}>Timeline</h1>
          <p style={cardSubtitle}>Visualise the stages and elapsed time for this application.</p>
        </div>
      </header>
      {segments.length === 0 ? (
        <p style={emptyState}>No timeline events recorded yet.</p>
      ) : (
        <div style={timelineWrapper}>
          <div style={ganttContainer}>
            {segments.map((segment) => (
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
            {segments.map((segment) => (
              <div key={`${segment.eventId}-legend`} style={legendItem}>
                <span style={{ ...legendDot, background: stageColorBadge(segment.stage) }} />
                <span>{segment.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ExtensionsPanel({
  applicationId,
  aggregate,
}: {
  applicationId: string;
  aggregate: ApplicationAggregateDto;
}) {
  const { mutate: globalMutate } = useSWRConfig();
  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle');
  const [draft, setDraft] = useState<ExtensionFormDraft>(() => buildDraft());
  const [selected, setSelected] = useState<ExtensionDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isLive = aggregate.application.status === 'Live';
  const extensions = useMemo(
    () => [...(aggregate.extensions ?? [])].sort((left, right) => left.agreedDate.localeCompare(right.agreedDate)),
    [aggregate.extensions]
  );

  function startCreate() {
    setMode('create');
    setSelected(null);
    setDraft(buildDraft());
    setError(null);
    setFeedback(null);
  }

  function startEdit(extension: ExtensionDto) {
    setMode('edit');
    setSelected(extension);
    setDraft(buildDraft(extension));
    setError(null);
    setFeedback(null);
  }

  function cancelForm() {
    setMode('idle');
    setSelected(null);
    setDraft(buildDraft());
    setError(null);
  }

  function handleFieldChange(field: keyof ExtensionFormDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setDraft((prev) => ({
        ...prev,
        [field]: value,
      }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.agreedDate.trim()) {
      setError('Agreed date is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      requestedDate: draft.requestedDate.trim() || null,
      agreedDate: draft.agreedDate,
      notes: draft.notes.trim() || null,
    };

    try {
      if (mode === 'edit' && selected) {
        await updateExtension(applicationId, selected.extensionId, payload);
        setFeedback('Extension updated.');
      } else {
        await createExtension(applicationId, payload);
        setFeedback('Extension created.');
      }

      await Promise.all([
        refreshApplicationCaches(globalMutate, applicationId, { includeIssues: false }),
        globalMutate(SWR_KEYS.dashboardOverview),
        globalMutate(SWR_KEYS.calendarApplications()),
      ]);

      setMode('idle');
      setSelected(null);
      setDraft(buildDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save extension');
    } finally {
      setSaving(false);
    }
  }

  const showForm = mode !== 'idle';

  return (
    <section style={extensionsCard}>
      <header style={cardHeader}>
        <div>
          <h1 style={{ margin: 0 }}>Extensions of time</h1>
          <p style={cardSubtitle}>Record and update agreed determination extensions.</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          style={{
            ...primaryButton,
            opacity: isLive ? 1 : 0.5,
            cursor: !isLive || saving ? 'not-allowed' : 'pointer',
          }}
          disabled={!isLive || saving}
        >
          Add extension
        </button>
      </header>

      {!isLive && (
        <p style={{ ...emptyState, color: 'var(--text-muted)' }}>
          Extensions can only be managed while the application is live.
        </p>
      )}
      {feedback && <p style={{ color: 'var(--success)', fontSize: 13 }}>{feedback}</p>}

      {extensions.length === 0 ? (
        <p style={emptyState}>No extensions recorded.</p>
      ) : (
        <ul style={extensionList}>
          {extensions.map((extension) => {
            const isEditing = mode === 'edit' && selected?.extensionId === extension.extensionId;
            return (
              <li
                key={extension.extensionId}
                style={{
                  ...extensionItem,
                  borderColor: isEditing ? 'var(--primary)' : 'var(--border)',
                }}
              >
                <div style={extensionInfo}>
                  <span style={extensionPrimary}>{formatIsoDate(extension.agreedDate)}</span>
                  <span style={extensionLabel}>Agreed determination date</span>
                  {extension.requestedDate && (
                    <span style={extensionMeta}>Requested {formatIsoDate(extension.requestedDate)}</span>
                  )}
                  {extension.notes && <p style={extensionNotes}>{extension.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(extension)}
                  style={{
                    ...tertiaryButton,
                    cursor: !isLive || saving ? 'not-allowed' : 'pointer',
                    opacity: !isLive || saving ? 0.5 : 1,
                  }}
                  disabled={!isLive || saving}
                >
                  Edit
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={extensionForm}>
          <div style={formGrid}>
            <label style={labelStyle}>
              Requested date
              <input
                type="date"
                value={draft.requestedDate}
                onChange={handleFieldChange('requestedDate')}
                style={inputStyle}
                disabled={saving}
              />
            </label>
            <label style={labelStyle}>
              Agreed date
              <input
                type="date"
                value={draft.agreedDate}
                onChange={handleFieldChange('agreedDate')}
                style={inputStyle}
                required
                disabled={saving}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Notes
            <textarea
              value={draft.notes}
              onChange={handleFieldChange('notes')}
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              disabled={saving}
            />
          </label>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
          <div style={extensionActions}>
            <button type="button" onClick={cancelForm} style={{ ...ghostButton, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              Cancel
            </button>
            <button type="submit" style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create extension'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function buildDraft(extension?: ExtensionDto | null): ExtensionFormDraft {
  return {
    requestedDate: extension?.requestedDate ?? '',
    agreedDate: extension?.agreedDate ?? '',
    notes: extension?.notes ?? '',
  };
}

function formatIsoDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch (error) {
    return value;
  }
}

function useTimelineSegments(aggregate: ApplicationAggregateDto): TimelineSegment[] {
  return useMemo(() => {
    const events = aggregate.timeline ?? [];
    if (events.length === 0) {
      return [];
    }
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const segments = sorted.map((event, index) => {
      const startDate = new Date(event.timestamp);
      const next = sorted[index + 1];
      const endDate = next ? new Date(next.timestamp) : new Date();
      const duration = Math.max(differenceInCalendarDays(endDate, startDate), 1);
      return {
        eventId: event.eventId,
        event: event.event,
        stage: event.stage,
        startDate,
        endDate,
        duration,
        details: event.details,
      };
    });
    const totalDuration = segments.reduce((acc, segment) => acc + segment.duration, 0) || segments.length;
    return segments.map((segment) => ({
      ...segment,
      widthPercent: Math.max((segment.duration / totalDuration) * 100, 12),
    }));
  }, [aggregate.timeline]);
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

const timelineCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
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

const emptyState: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted)',
};

const timelineWrapper: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const ganttContainer: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
};

const ganttSegment: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: '#fff',
  padding: '18px 20px',
  borderRadius: 14,
  minWidth: 220,
};

const ganttLabel: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
};

const ganttDates: CSSProperties = {
  fontSize: 13,
};

const ganttDetails: CSSProperties = {
  fontSize: 12,
  opacity: 0.85,
};

const timelineLegend: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
};

const legendItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: 'var(--text-muted)',
};

const legendDot: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  display: 'inline-block',
};

const extensionsCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const extensionList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const extensionItem: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  gap: 16,
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};

const extensionInfo: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: '1 1 auto',
};

const extensionPrimary: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
};

const extensionLabel: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const extensionMeta: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const extensionNotes: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 13,
  lineHeight: 1.4,
};

const extensionForm: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  borderTop: '1px solid var(--border)',
  paddingTop: 16,
  marginTop: 8,
};

const formGrid: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: 'var(--text-muted)',
  flex: '1 1 220px',
};

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: '10px 12px',
  fontSize: 14,
};

const extensionActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const ghostButton: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  borderRadius: 999,
  padding: '10px 18px',
  fontWeight: 600,
};

const tertiaryButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--primary)',
  fontWeight: 600,
  padding: '6px 12px',
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

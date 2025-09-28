'use client';

import { useEffect, useMemo, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { differenceInCalendarDays, format } from 'date-fns';
import useSWR from 'swr';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useNavigation, buildBreadcrumbs } from '@/contexts/NavigationContext';
import {
  fetchApplication,
  SWR_KEYS,
  type ApplicationAggregateDto,
} from '@/lib/api';
import { useAppNavigation } from '@/lib/useAppNavigation';
import { ApplicationExtensionsPanel } from '@/components/ApplicationExtensionsPanel';

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

export function ApplicationTimelinePage({ applicationId }: Props) {
  const pathname = usePathname();
  const { dispatch } = useNavigation();
  const { goBack } = useAppNavigation();
  const { data, error, isLoading, mutate } = useSWR<ApplicationAggregateDto>(
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
      <ApplicationExtensionsPanel
        applicationId={applicationId}
        aggregate={data}
        onUpdated={mutate}
      />
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

const primaryButton: CSSProperties = {
  background: 'var(--primary)',
  border: 'none',
  color: '#fff',
  borderRadius: 999,
  fontWeight: 600,
  padding: '12px 22px',
  cursor: 'pointer',
};

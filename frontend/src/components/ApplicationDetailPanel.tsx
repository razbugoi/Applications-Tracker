'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { fetchApplication, SWR_KEYS, type ApplicationAggregateDto } from '@/lib/api';
import { useAppNavigation } from '@/lib/useAppNavigation';

interface Props {
  applicationId: string;
}

export function ApplicationDetailPanel({ applicationId }: Props) {
  const { data, error, isLoading } = useSWR<ApplicationAggregateDto>(
    SWR_KEYS.applicationAggregate(applicationId),
    () => fetchApplication(applicationId)
  );

  const { goToApplication } = useAppNavigation();

  if (isLoading) {
    return (
      <div style={panelStyle}>
        <LoadingSpinner size="md" message="Loading application…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={panelStyle}>
        <p style={{ color: 'var(--danger)' }}>Unable to load application</p>
      </div>
    );
  }

  const { application, issues, timeline } = data;
  const issueSummary = useMemo(() => buildIssueSummary(issues ?? []), [issues]);
  const timelineSummary = useMemo(() => buildTimelineSummary(timeline ?? []), [timeline]);
  const detailItems = buildDetailItems(application);

  return (
    <div style={panelStyle}>
      <header style={summaryCard}>
        <div style={summaryHeader}>
          <div style={summaryTitleBlock}>
            <span style={panelSubtitle}>{application.ppReference}</span>
            <h2 style={{ margin: 0, fontSize: 24 }}>{application.prjCodeName}</h2>
            {application.description ? (
              <p style={summaryDescription}>{application.description}</p>
            ) : null}
          </div>
          <div style={summaryMetaColumn}>
            <div style={statusBadge(application.status)}>{application.status ?? 'Unknown'}</div>
            <nav style={actionGroup} aria-label="Application navigation">
              <button type="button" style={primaryButton} onClick={() => goToApplication(application.applicationId, 'edit')}>
                Edit details
              </button>
              <button type="button" style={secondaryButton} onClick={() => goToApplication(application.applicationId, 'issues')}>
                Manage issues
              </button>
              <button type="button" style={secondaryButton} onClick={() => goToApplication(application.applicationId, 'timeline')}>
                View timeline
              </button>
            </nav>
          </div>
        </div>
        <div style={summaryStatsRow}>
          <div style={summaryStat}>
            <span style={summaryStatLabel}>Submission</span>
            <span style={summaryStatValue}>{formatDate(application.submissionDate)}</span>
          </div>
          <div style={summaryStat}>
            <span style={summaryStatLabel}>Validation</span>
            <span style={summaryStatValue}>{formatDate(application.validationDate)}</span>
          </div>
          <div style={summaryStat}>
            <span style={summaryStatLabel}>Determination</span>
            <span style={summaryStatValue}>{formatDate(application.determinationDate)}</span>
          </div>
          <div style={summaryStat}>
            <span style={summaryStatLabel}>Outcome</span>
            <span style={summaryStatValue}>{application.outcome ?? '—'}</span>
          </div>
        </div>
      </header>

      <section style={sectionStyle}>
        <header style={sectionHeader}>
          <h3 style={sectionTitle}>Key details</h3>
        </header>
        <div style={detailGrid}>
          {detailItems.map((item) => (
            <div
              key={item.label}
              style={{
                ...detailCard,
                ...(item.layout === 'wide' ? detailCardWide : null),
              }}
            >
              <span style={detailLabel}>{item.label}</span>
              <span style={detailValue}>{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeader}>
          <h3 style={sectionTitle}>Issues</h3>
          <button
            type="button"
            style={linkButton}
            onClick={() => goToApplication(application.applicationId, 'issues')}
          >
            Go to issues →
          </button>
        </header>
        {issueSummary.total === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No issues recorded for this application.</p>
        ) : (
          <div style={issueSummaryGrid}>
            <div style={issueStat}>
              <span style={issueStatValue}>{issueSummary.total}</span>
              <span style={issueStatLabel}>Total issues</span>
            </div>
            <div style={issueList}>
              {issueSummary.top.map((issue) => (
                <div key={issue.issueId} style={issueListItem}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>{issue.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {issue.category} • {issue.status}
                    </span>
                  </div>
                  <span style={issueTag}>{formatDate(issue.dueDate)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeader}>
          <h3 style={sectionTitle}>Timeline</h3>
          <button
            type="button"
            style={linkButton}
            onClick={() => goToApplication(application.applicationId, 'timeline')}
          >
            Open timeline →
          </button>
        </header>
        {timelineSummary.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No timeline events recorded yet.</p>
        ) : (
          <ul style={timelineList}>
            {timelineSummary.map((item) => (
              <li key={item.eventId} style={timelineItem}>
                <span style={timelineStage}>{item.stage}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{item.event}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.range}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function buildIssueSummary(issues: ApplicationAggregateDto['issues']): {
  total: number;
  top: typeof issues;
} {
  const total = issues.length;
  const top = issues.slice(0, 3);
  return { total, top };
}

function buildTimelineSummary(timeline: ApplicationAggregateDto['timeline']) {
  return timeline.slice(0, 4).map((event) => {
    const start = formatDate(event.timestamp);
    return {
      eventId: event.eventId,
      event: event.event,
      stage: event.stage,
      range: start,
    };
  });
}

function buildDetailItems(application: ApplicationAggregateDto['application']): DetailItem[] {
  const portalUrl = application.planningPortalUrl
    ? (
        <a href={application.planningPortalUrl} target="_blank" rel="noopener noreferrer" style={detailLink}>
          Visit portal ↗
        </a>
      )
    : (
        <span style={mutedText}>Not provided</span>
      );

  const caseOfficer = application.caseOfficer
    ? application.caseOfficerEmail
      ? (
          <a href={`mailto:${application.caseOfficerEmail}`} style={detailLink}>
            {application.caseOfficer}
          </a>
        )
      : (
          application.caseOfficer
        )
    : (
        <span style={mutedText}>—</span>
      );

  return [
    { label: 'PP reference', value: application.ppReference ?? '—' },
    { label: 'LPA reference', value: application.lpaReference ?? '—' },
    { label: 'Council', value: application.council ?? '—' },
    { label: 'Planning portal', value: portalUrl },
    { label: 'Case officer', value: caseOfficer },
    {
      label: 'Case officer email',
      value: application.caseOfficerEmail ? (
        <a href={`mailto:${application.caseOfficerEmail}`} style={detailLink}>
          {application.caseOfficerEmail}
        </a>
      ) : (
        <span style={mutedText}>Not provided</span>
      ),
    },
    { label: 'Submission date', value: formatDate(application.submissionDate) },
    { label: 'Validation date', value: formatDate(application.validationDate) },
    { label: 'Determination date', value: formatDate(application.determinationDate) },
    { label: 'Extension of time', value: formatDate(application.eotDate) },
    { label: 'Outcome', value: application.outcome ?? '—' },
    {
      label: 'Notes',
      value: application.notes ? application.notes : <span style={mutedText}>No internal notes</span>,
      layout: 'wide',
    },
  ];
}

interface DetailItem {
  label: string;
  value: ReactNode;
  layout?: 'wide';
}

function statusBadge(status?: string): CSSProperties {
  const color = stageColor(status);
  return {
    alignSelf: 'flex-start',
    padding: '8px 18px',
    borderRadius: 999,
    color: '#fff',
    fontWeight: 600,
    background: color,
    fontSize: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  };
}

function stageColor(status?: string) {
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

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  try {
    return format(new Date(value), 'dd MMM yyyy');
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

const panelSubtitle: CSSProperties = {
  fontSize: 14,
  color: 'var(--text-muted)',
};

const summaryCard: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(238, 242, 255, 0.6))',
  borderRadius: 20,
  border: '1px solid rgba(99, 102, 241, 0.15)',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const summaryHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 24,
  flexWrap: 'wrap',
};

const summaryTitleBlock: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxWidth: 600,
};

const summaryDescription: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted)',
  lineHeight: 1.4,
};

const summaryMetaColumn: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  alignItems: 'flex-end',
  minWidth: 200,
  flex: '1 1 auto',
};

const summaryStatsRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 14,
};

const summaryStat: CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid rgba(255, 255, 255, 0.6)',
  boxShadow: '0 6px 18px rgba(79, 70, 229, 0.08)',
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const summaryStatLabel: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--text-muted)',
  fontWeight: 600,
};

const summaryStatValue: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
};

const actionGroup: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const sectionStyle: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const sectionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sectionTitle: CSSProperties = {
  margin: 0,
};

const detailGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 14,
};

const detailCard: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid var(--border-subtle)',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minHeight: 82,
};

const detailCardWide: CSSProperties = {
  gridColumn: '1 / -1',
};

const detailLabel: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.35,
  color: 'var(--text-muted)',
  fontWeight: 600,
};

const detailValue: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text)',
  lineHeight: 1.4,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const primaryButton: CSSProperties = {
  background: 'var(--primary)',
  border: '1px solid var(--primary)',
  color: '#fff',
  borderRadius: 999,
  fontWeight: 600,
  padding: '8px 18px',
  cursor: 'pointer',
  fontSize: 13,
  boxShadow: '0 8px 20px rgba(79, 70, 229, 0.2)',
};

const secondaryButton: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.85)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 999,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: 13,
};

const linkButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--primary)',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
};

const issueSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)',
  gap: 20,
  alignItems: 'stretch',
};

const issueStat: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))',
  borderRadius: 10,
  padding: 14,
  justifyContent: 'center',
  textAlign: 'center',
};

const issueStatValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
};

const issueStatLabel: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
};

const issueList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const issueListItem: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '12px 16px',
  borderRadius: 12,
  border: '1px solid var(--border-subtle)',
  background: '#fff',
};

const issueTag: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  background: 'rgba(15, 118, 110, 0.12)',
  padding: '4px 10px',
  borderRadius: 999,
};

const timelineList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const timelineItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid var(--border-subtle)',
  background: '#fff',
};

const timelineStage: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 999,
  background: 'rgba(15, 118, 110, 0.12)',
  color: 'var(--primary)',
  fontSize: 11.5,
  fontWeight: 600,
};

const detailLink: CSSProperties = {
  color: 'var(--primary)',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const mutedText: CSSProperties = {
  color: 'var(--text-muted)',
  fontWeight: 500,
};

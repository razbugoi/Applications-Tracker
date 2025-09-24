'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Route } from 'next';
import { listApplications, listIssues, type IssueDto, type ApplicationDto } from '@/lib/api';
import { NewApplicationForm } from '@/components/NewApplicationForm';
import { ApplicationDetailPanel } from '@/components/ApplicationDetailPanel';
import { Modal } from '@/components/Modal';

const STATUS_META = [
  {
    key: 'Submitted',
    label: 'Submitted',
    description: 'Awaiting validation and ready for triage.',
    href: '/submitted',
  },
  {
    key: 'Invalidated',
    label: 'Invalidated',
    description: 'Applications with outstanding issues to resolve.',
    href: '/invalidated',
  },
  {
    key: 'Live',
    label: 'Live',
    description: 'Validated applications progressing through assessment.',
    href: '/live',
  },
  {
    key: 'Determined',
    label: 'Determined',
    description: 'Completed cases with recorded outcomes.',
    href: '/determined',
  },
] satisfies Array<{
  key: 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
  label: string;
  description: string;
  href: Route;
}>;

export default function DashboardPage() {
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const { data, isLoading, error, mutate } = useSWR('dashboard-overview', async () => {
    const [submitted, invalidated, live, determined, issues] = await Promise.all([
      listApplications('Submitted'),
      listApplications('Invalidated'),
      listApplications('Live'),
      listApplications('Determined'),
      listIssues(),
    ]);

    const counts = {
      Submitted: submitted.items.length,
      Invalidated: invalidated.items.length,
      Live: live.items.length,
      Determined: determined.items.length,
      Issues: issues.items.length,
    };

    const latestIssues = issues.items.slice(0, 5);
    const outcomeSummary = summarizeOutcomes(determined.items);
    const upcomingDeterminations = getUpcomingDeterminations([...live.items, ...submitted.items]);
    return { counts, latestIssues, outcomeSummary, upcomingDeterminations };
  });

  const issuesByStatus = useMemo(() => {
    const buckets: Record<string, number> = {};
    data?.latestIssues.forEach((issue) => {
      buckets[issue.status] = (buckets[issue.status] ?? 0) + 1;
    });
    return buckets;
  }, [data?.latestIssues]);

  return (
    <div style={layout}>
      <section style={heroSection}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 16 }}>
            Keep track of workload, key statuses, and recent issues at a glance.
          </p>
        </div>
        <NewApplicationForm
          onCreated={async (_application: ApplicationDto) => {
            await mutate();
          }}
        />
      </section>

      <section style={statsSection} aria-label="Status summary">
        {STATUS_META.map((meta) => {
          const count = data?.counts?.[meta.key] ?? 0;
          return (
            <Link key={meta.key} href={meta.href} style={statCard}>
              <span style={statCount}>{isLoading ? '—' : count}</span>
              <div>
                <div style={statTitle}>{meta.label}</div>
                <p style={statDescription}>{meta.description}</p>
              </div>
            </Link>
          );
        })}
        <Link key="issues" href="/issues" style={statCard}>
          <span style={statCount}>{isLoading ? '—' : data?.counts?.Issues ?? 0}</span>
          <div>
            <div style={statTitle}>Issues</div>
            <p style={statDescription}>All application issues across the portfolio.</p>
          </div>
        </Link>
      </section>

      <section style={issuesSection} aria-label="Recent issues">
        <header style={sectionHeader}>
          <h2 style={{ margin: 0 }}>Latest Issues</h2>
          <Link href="/issues" style={sectionLink}>
            View all issues
          </Link>
        </header>

        {error && <p style={messageStyle}>Failed to load latest issues.</p>}
        {!error && (data?.latestIssues.length ?? 0) === 0 && !isLoading && (
          <p style={messageStyle}>No issues recorded yet.</p>
        )}
        {isLoading && <p style={messageStyle}>Loading latest issues…</p>}

        {!isLoading && !error && (data?.latestIssues.length ?? 0) > 0 && (
          <ul style={issuesList}>
            {data?.latestIssues.map((issue) => (
              <IssueRow key={issue.issueId} issue={issue} />
            ))}
          </ul>
        )}
      </section>

      <section style={insightSection} aria-label="Issue distribution">
        <h2 style={{ margin: '0 0 12px' }}>Issues snapshot</h2>
        <div style={chipRow}>
          {['Open', 'In Progress', 'Resolved', 'Closed'].map((status) => (
            <span key={status} style={chip}>
              {status}: {issuesByStatus[status] ?? 0}
            </span>
          ))}
        </div>
      </section>

      <section style={insightSection} aria-label="Upcoming determinations">
        <header style={sectionHeader}>
          <h2 style={{ margin: 0 }}>Upcoming determinations</h2>
          <Link href="/calendar" style={sectionLink}>
            View calendar
          </Link>
        </header>
        {isLoading && <p style={messageStyle}>Loading upcoming determinations…</p>}
        {!isLoading && (data?.upcomingDeterminations.length ?? 0) === 0 && (
          <p style={messageStyle}>No upcoming determination dates captured.</p>
        )}
        {!isLoading && data && data.upcomingDeterminations.length > 0 && (
          <ul style={upcomingList}>
            {data.upcomingDeterminations.slice(0, 5).map((item) => (
              <li key={item.applicationId} style={upcomingRow}>
                <button
                  onClick={() => setSelectedApplicationId(item.applicationId)}
                  style={eventLink}
                >
                  {item.prjCodeName}
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(item.determinationDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={outcomeSection} aria-label="Outcome snapshot">
        <header style={sectionHeader}>
          <h2 style={{ margin: 0 }}>Outcome snapshot</h2>
          <Link href="/outcomes" style={sectionLink}>
            View full report
          </Link>
        </header>
        {isLoading && <p style={messageStyle}>Loading outcome data…</p>}
        {!isLoading && data?.outcomeSummary && (
          <div style={outcomeGrid}>
            <OutcomeChip label="Determined" value={data.outcomeSummary.total} />
            <OutcomeChip label="Approved" value={data.outcomeSummary.approved} tone="success" />
            <OutcomeChip label="Refused" value={data.outcomeSummary.refused} tone="danger" />
            <OutcomeChip label="Withdrawn" value={data.outcomeSummary.withdrawn} tone="warning" />
            <OutcomeChip
              label="Approval Rate"
              value={`${data.outcomeSummary.approvalRate.toFixed(1)}%`}
              tone="success"
            />
          </div>
        )}
      </section>

      {selectedApplicationId && (
        <Modal onClose={() => setSelectedApplicationId(null)}>
          <ApplicationDetailPanel
            applicationId={selectedApplicationId}
            onClose={() => setSelectedApplicationId(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: IssueDto }) {
  return (
    <li style={issueItem}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 600 }}>{issue.title}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {issue.prjCodeName ?? 'Unknown project'} • {issue.status}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>Raised {formatDate(issue.dateRaised)}</span>
        <span>Due {formatDate(issue.dueDate)}</span>
      </div>
    </li>
  );
}

function summarizeOutcomes(applications: ApplicationDto[]) {
  const summary = {
    total: applications.length,
    approved: 0,
    refused: 0,
    withdrawn: 0,
    approvalRate: 0,
  };

  if (applications.length === 0) {
    return summary;
  }

  applications.forEach((application) => {
    const outcome = application.outcome ?? 'Pending';
    if (outcome === 'Approved' || outcome === 'Permitted') {
      summary.approved += 1;
    } else if (outcome === 'Refused') {
      summary.refused += 1;
    } else if (outcome === 'Withdrawn') {
      summary.withdrawn += 1;
    }
  });

  summary.approvalRate = summary.total === 0 ? 0 : (summary.approved / summary.total) * 100;
  return summary;
}

function getUpcomingDeterminations(applications: ApplicationDto[]) {
  const today = new Date();
  return applications
    .filter((application) => {
      if (!application.determinationDate) {
        return false;
      }
      const date = new Date(application.determinationDate);
      return !Number.isNaN(date.getTime()) && date >= today;
    })
    .sort((a, b) => (a.determinationDate ?? '').localeCompare(b.determinationDate ?? ''));
}

function OutcomeChip({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const palette: Record<string, { background: string; color: string }> = {
    default: { background: 'rgba(37, 99, 235, 0.08)', color: '#1d4ed8' },
    success: { background: 'rgba(34, 197, 94, 0.12)', color: '#15803d' },
    danger: { background: 'rgba(220, 38, 38, 0.12)', color: '#b91c1c' },
    warning: { background: 'rgba(234, 179, 8, 0.12)', color: '#b45309' },
  };

  return (
    <div style={{ ...outcomeChip, ...palette[tone] }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      <strong style={{ fontSize: 18 }}>{value}</strong>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

const layout: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  padding: '32px 24px 64px',
  maxWidth: 1080,
  margin: '0 auto',
};

const heroSection: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  flexWrap: 'wrap',
};

const statsSection: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
  alignItems: 'stretch',
};

const statCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '20px 18px',
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.8)',
  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.08)',
  textDecoration: 'none',
  color: 'inherit',
};

const statCount: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 700,
};

const statTitle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 16,
};

const statDescription: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--text-muted)',
};

const issuesSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
};

const sectionLink: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--primary)',
  fontWeight: 600,
};

const messageStyle: React.CSSProperties = {
  margin: 0,
  padding: 24,
  textAlign: 'center',
  color: 'var(--text-muted)',
  border: '1px dashed var(--border)',
  borderRadius: 16,
};

const issuesList: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const issueItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '16px 18px',
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'rgba(248, 250, 252, 0.9)',
};

const insightSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const chipRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
};

const chip: React.CSSProperties = {
  borderRadius: 999,
  border: '1px solid var(--border)',
  padding: '6px 12px',
  background: 'rgba(37, 99, 235, 0.12)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
};

const upcomingList: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const upcomingRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '10px 12px',
  background: 'rgba(248, 250, 252, 0.9)',
};

const outcomeSection: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const outcomeGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
};

const outcomeChip: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 14,
  padding: '12px 14px',
  border: '1px solid transparent',
};

const eventLink: React.CSSProperties = {
  fontWeight: 600,
  textDecoration: 'none',
  color: 'var(--text)',
};

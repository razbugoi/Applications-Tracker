'use client';

import useSWR from 'swr';
import { listApplications, type ApplicationDto } from '@/lib/api';
import type { CSSProperties } from 'react';

interface DistributionItem {
  outcome: string;
  count: number;
  percentage: number;
}

export function OutcomeSummary() {
  const { data, error, isLoading } = useSWR('outcome-summary', async () => {
    const response = await listApplications('Determined');
    return response.items;
  });

  const applications = data ?? [];
  const total = applications.length;

  const distribution: DistributionItem[] = computeDistribution(applications);
  const approved = distribution.find((item) => item.outcome === 'Approved' || item.outcome === 'Permitted')?.count ?? 0;
  const refused = distribution.find((item) => item.outcome === 'Refused')?.count ?? 0;
  const withdrawn = distribution.find((item) => item.outcome === 'Withdrawn')?.count ?? 0;
  const approvalRate = total === 0 ? 0 : Math.round((approved / total) * 1000) / 10;

  return (
    <main style={layout}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Outcome Summary</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 16 }}>
            Performance snapshot for determined applications. Track approvals, refusals, and withdrawals at a glance.
          </p>
        </div>
      </header>

      {isLoading && <p style={messageStyle}>Loading outcome data…</p>}
      {error && <p style={{ ...messageStyle, color: 'var(--danger)' }}>Failed to load outcome data.</p>}

      {!isLoading && !error && (
        <>
          <section style={statsGrid}>
            <SummaryCard label="Determined" value={total} caption="Total decisions issued" />
            <SummaryCard label="Approved" value={approved} caption="Applications permitted" tone="success" />
            <SummaryCard label="Refused" value={refused} caption="Applications refused" tone="danger" />
            <SummaryCard label="Withdrawn" value={withdrawn} caption="Applications withdrawn" tone="warning" />
            <SummaryCard
              label="Approval Rate"
              value={`${approvalRate.toFixed(1)}%`}
              caption="Approved vs total decisions"
              tone="success"
            />
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitle}>Outcome Distribution</h2>
            {distribution.length === 0 ? (
              <p style={messageStyle}>No determined applications yet.</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th scope="col" style={tableHeaderStyle}>Outcome</th>
                    <th scope="col" style={tableHeaderStyle}>Applications</th>
                    <th scope="col" style={tableHeaderStyle}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.map((item) => (
                    <tr key={item.outcome}>
                      <td style={tableCellStyle}>{item.outcome}</td>
                      <td style={tableCellStyle}>{item.count}</td>
                      <td style={tableCellStyle}>{item.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitle}>Latest Decisions</h2>
            {applications.length === 0 ? (
              <p style={messageStyle}>No determined applications to display.</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th scope="col" style={tableHeaderStyle}>Project</th>
                    <th scope="col" style={tableHeaderStyle}>Outcome</th>
                    <th scope="col" style={tableHeaderStyle}>Determination Date</th>
                    <th scope="col" style={tableHeaderStyle}>Case Officer</th>
                  </tr>
                </thead>
                <tbody>
                  {[...applications]
                    .sort((a, b) => (b.determinationDate ?? '').localeCompare(a.determinationDate ?? ''))
                    .slice(0, 10)
                    .map((application) => (
                      <tr key={application.applicationId}>
                        <td style={tableCellStyle}>{application.prjCodeName}</td>
                        <td>{application.outcome ?? '—'}</td>
                        <td style={tableCellStyle}>{formatDate(application.determinationDate)}</td>
                        <td>{application.caseOfficer ?? '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function computeDistribution(applications: ApplicationDto[]): DistributionItem[] {
  if (applications.length === 0) {
    return [];
  }
  const counts: Record<string, number> = {};
  applications.forEach((application) => {
    const outcome = application.outcome ?? 'Pending';
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  });

  const total = applications.length;
  return Object.entries(counts)
    .map(([outcome, count]) => ({ outcome, count, percentage: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

function SummaryCard({
  label,
  value,
  caption,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  caption: string;
  tone?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const palette: Record<string, CSSProperties> = {
    default: { background: 'rgba(37, 99, 235, 0.08)', color: '#1d4ed8' },
    success: { background: 'rgba(34, 197, 94, 0.12)', color: '#15803d' },
    danger: { background: 'rgba(220, 38, 38, 0.12)', color: '#b91c1c' },
    warning: { background: 'rgba(234, 179, 8, 0.12)', color: '#b45309' },
  };

  return (
    <article style={{ ...cardStyle, ...palette[tone] }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
      <strong style={{ fontSize: 32 }}>{value}</strong>
      <span style={{ fontSize: 12, opacity: 0.8 }}>{caption}</span>
    </article>
  );
}

function formatDate(value?: string) {
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
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  padding: '32px 24px 64px',
  maxWidth: 1080,
  margin: '0 auto',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const statsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
};

const cardStyle: CSSProperties = {
  padding: '20px 18px',
  borderRadius: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.08)',
};

const sectionStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
  background: 'var(--surface)',
};

const sectionTitle: CSSProperties = {
  margin: '0 0 16px',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const tableHeaderStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
};

const tableCellStyle: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
};

const messageStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: 'var(--text-muted)',
};


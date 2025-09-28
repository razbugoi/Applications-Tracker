'use client';

import { type CSSProperties, type KeyboardEvent, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import { listApplications, SWR_KEYS, type ApplicationDto } from '@/lib/api';
import councilPortals from '../../../config/council-portals.json';
import { NewApplicationForm } from './NewApplicationForm';
import { useAppNavigation } from '@/lib/useAppNavigation';

const PORTAL_DEFAULTS = councilPortals as Record<string, string>;

function resolvePlanningPortal(application: ApplicationDto) {
  if (application.planningPortalUrl) {
    return application.planningPortalUrl;
  }
  const council = application.council?.trim();
  if (council && PORTAL_DEFAULTS[council]) {
    return PORTAL_DEFAULTS[council];
  }
  if (council) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${council} planning applications`)}`;
  }
  return undefined;
}

const layout: CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const troublesStyle: CSSProperties = {
  padding: 48,
  textAlign: 'center',
  color: 'var(--text-muted)',
};

const tableWrapper: CSSProperties = {
  marginTop: 8,
};

const loadMoreRow: CSSProperties = {
  marginTop: 16,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 12,
};

const loadMoreButton: CSSProperties = {
  padding: '10px 18px',
  borderRadius: 8,
  border: '1px solid var(--primary)',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const loadMoreMeta: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

interface StatusPageProps {
  status: 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
  title: string;
  subtitle: string;
}

export function StatusPage({ status, title, subtitle }: StatusPageProps) {
  const { data, error, size, setSize, isValidating } = useSWRInfinite(
    (pageIndex, previousPage) => {
      if (previousPage && !previousPage.nextToken) {
        return null;
      }
      const cursor = pageIndex === 0 ? null : previousPage?.nextToken ?? null;
      return [...SWR_KEYS.applicationsByStatus(status), cursor ?? ''] as const;
    },
    async ([, , statusKey, cursorToken]) => {
      const cursor = cursorToken ? (cursorToken as string) : null;
      return listApplications(statusKey as typeof status, { cursor, limit: 50 });
    },
    { revalidateFirstPage: false }
  );
  const pages = data ?? [];
  const items = pages.flatMap((page) => page.items);
  const totalCount = pages[0]?.totalCount ?? (pages.length > 0 ? items.length : 0);
  const isInitialLoading = !data && !error;
  const isLoadingMore = isValidating && data !== undefined && size > data.length;
  const hasMore = Boolean(pages[pages.length - 1]?.nextToken);
  const { goToApplication } = useAppNavigation();

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        (left.prjCodeName ?? '').localeCompare(right.prjCodeName ?? '', undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      ),
    [items]
  );

  const buildDescription = (application: ApplicationDto) => {
    return (application.description ?? '').replace(/\s+/g, ' ').trim();
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToApplication(id);
    }
  };

  return (
    <main style={layout}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>{title}</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{subtitle}</p>
          </div>
          <NewApplicationForm />
        </div>
      </header>

      {isInitialLoading && <p style={troublesStyle}>Loading applications…</p>}
      {error && <p style={{ ...troublesStyle, color: 'var(--danger)' }}>Failed to load applications</p>}
      {!isInitialLoading && !error && totalCount === 0 && <p style={troublesStyle}>No applications recorded yet.</p>}
      <section style={tableWrapper}>
        <div className="status-table-wrapper">
          <div className="status-table-scroll">
            <table className="status-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Project</th>
                  <th scope="col">PP Ref</th>
                  <th scope="col">LPA Ref</th>
                  <th scope="col">Description</th>
                  <th scope="col">Council</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Validated</th>
                  <th scope="col">Determination</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Case Officer</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((application, index) => {
                  const description = buildDescription(application);
                  const councilHref = resolvePlanningPortal(application);
                  return (
                    <tr
                      key={application.applicationId}
                      onClick={() => goToApplication(application.applicationId)}
                      onKeyDown={(event) => handleRowKeyDown(event, application.applicationId)}
                      tabIndex={0}
                    >
                      <td className="status-table__cell--index">{index + 1}</td>
                      <td className="status-table__cell--project" title={application.prjCodeName}>
                        {application.prjCodeName}
                      </td>
                      <td title={application.ppReference ?? '—'}>{application.ppReference ?? '—'}</td>
                      <td title={application.lpaReference ?? '—'}>{application.lpaReference ?? '—'}</td>
                      <td className="status-table__cell--description" title={description}>
                        {description || '—'}
                      </td>
                      <td className="status-table__cell--council" title={application.council ?? '—'}>
                        {application.council ? (
                          councilHref ? (
                            <a
                              href={councilHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {application.council}
                            </a>
                          ) : (
                            <span>{application.council}</span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{formatDate(application.submissionDate)}</td>
                      <td>{formatDate(application.validationDate)}</td>
                      <td>{formatDate(application.determinationDate)}</td>
                      <td>{application.outcome ?? '—'}</td>
                      <td>
                        {application.caseOfficer ? (
                          application.caseOfficerEmail ? (
                            <a
                              href={`mailto:${application.caseOfficerEmail}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {application.caseOfficer}
                            </a>
                          ) : (
                            application.caseOfficer
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {hasMore && (
        <div style={loadMoreRow}>
          <button
            type="button"
            onClick={() => setSize(size + 1)}
            disabled={isLoadingMore}
            style={loadMoreButton}
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
          <span style={loadMoreMeta}>
            Showing {items.length} of {totalCount}
          </span>
        </div>
      )}

    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  if (value.length === 10 && /\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString();
  }
  return value;
}

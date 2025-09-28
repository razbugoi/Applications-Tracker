'use client';

import useSWRInfinite from 'swr/infinite';
import { useMemo, type CSSProperties } from 'react';
import { listApplications, SWR_KEYS } from '@/lib/api';
import { ApplicationCard } from './ApplicationCard';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  status: 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
  title: string;
  subtitle: string;
  onSelect: (applicationId: string) => void;
}

const PAGE_SIZE = 25;

export function StatusColumn({ status, title, subtitle, onSelect }: Props) {
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
      return listApplications(statusKey as typeof status, { cursor, limit: PAGE_SIZE });
    },
    { revalidateFirstPage: false }
  );

  const pages = data ?? [];
  const items = pages.flatMap((page) => page.items);
  const totalCount = pages[0]?.totalCount ?? (pages.length > 0 ? items.length : 0);
  const isInitialLoading = !data && !error;
  const isLoadingMore = isValidating && data !== undefined && size > data.length;
  const hasMore = Boolean(pages[pages.length - 1]?.nextToken);
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

  return (
    <section data-testid={`status-column-${status.toLowerCase()}`} style={columnStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
        </div>
        <span style={badgeStyle}>{totalCount}</span>
      </header>
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {(isInitialLoading || (items.length === 0 && isLoadingMore)) && (
          <div style={spinnerWrapper}>
            <LoadingSpinner size="sm" />
          </div>
        )}
        {error && <p style={{ ...infoText, color: 'var(--danger)' }}>Failed to load</p>}
        {!isInitialLoading && !isLoadingMore && !error && totalCount === 0 && <p style={infoText}>No records</p>}
        {sortedItems.map((application, index) => (
          <ApplicationCard
            key={application.applicationId}
            application={application}
            index={index + 1}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hasMore && (
        <div style={loadMoreSection}>
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
    </section>
  );
}

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  background: 'rgba(255,255,255,0.6)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 16,
  minHeight: 480,
  maxHeight: '80vh',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const badgeStyle: CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 999,
  fontSize: 12,
  padding: '2px 10px',
};

const infoText: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const spinnerWrapper: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '12px 0',
};

const loadMoreSection: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 12,
};

const loadMoreButton: CSSProperties = {
  padding: '8px 14px',
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

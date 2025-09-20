'use client';

import useSWR from 'swr';
import type { CSSProperties } from 'react';
import { listApplications } from '@/lib/api';
import { ApplicationCard } from './ApplicationCard';

interface Props {
  status: 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
  title: string;
  subtitle: string;
  onSelect: (applicationId: string) => void;
}

export function StatusColumn({ status, title, subtitle, onSelect }: Props) {
  const { data, error, isLoading } = useSWR(['applications', status], () => listApplications(status));
  const items = data?.items ?? [];

  return (
    <section style={columnStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
        </div>
        <span style={badgeStyle}>{items.length}</span>
      </header>
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {isLoading && <p style={infoText}>Loading…</p>}
        {error && <p style={{ ...infoText, color: 'var(--danger)' }}>Failed to load</p>}
        {!isLoading && !error && items.length === 0 && <p style={infoText}>No records</p>}
        {items.map((application) => (
          <ApplicationCard key={application.applicationId} application={application} onSelect={onSelect} />
        ))}
      </div>
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

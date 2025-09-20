'use client';

import { format } from 'date-fns';
import type { ApplicationDto } from '@/lib/api';
import type { CSSProperties } from 'react';

interface Props {
  application: ApplicationDto;
  onSelect: (applicationId: string) => void;
}

export function ApplicationCard({ application, onSelect }: Props) {
  const submission = application.submissionDate ? format(new Date(application.submissionDate), 'dd MMM yyyy') : '—';
  const determination = application.determinationDate
    ? format(new Date(application.determinationDate), 'dd MMM yyyy')
    : '—';
  const validation = application.validationDate ? format(new Date(application.validationDate), 'dd MMM yyyy') : '—';

  return (
    <button type="button" onClick={() => onSelect(application.applicationId)} style={buttonStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{application.prjCodeName}</div>
      <div style={metaRow}>
        <span style={label}>PP Ref:</span>
        <span>{application.ppReference}</span>
      </div>
      {application.lpaReference && (
        <div style={metaRow}>
          <span style={label}>LPA:</span>
          <span>{application.lpaReference}</span>
        </div>
      )}
      <div style={metaRow}>
        <span style={label}>Submitted:</span>
        <span>{submission}</span>
      </div>
      <div style={metaRow}>
        <span style={label}>Validated:</span>
        <span>{validation}</span>
      </div>
      <div style={metaRow}>
        <span style={label}>Determination:</span>
        <span>{determination}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{application.description}</div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>Issues: {application.issuesCount ?? 0}</span>
        <span>{application.council}</span>
      </div>
    </button>
  );
}

const buttonStyle: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  marginBottom: 12,
};

const metaRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  fontSize: 12,
  color: 'var(--text-muted)',
};

const label: CSSProperties = {
  fontWeight: 500,
};

'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { NewApplicationForm } from './NewApplicationForm';
import { StatusColumn } from './StatusColumn';
import { ApplicationDetailPanel } from './ApplicationDetailPanel';
import { Modal } from './Modal';
import type { ApplicationDto } from '@/lib/api';

const COLUMNS = [
  {
    status: 'Submitted' as const,
    title: 'Submitted',
    subtitle: 'Awaiting validation',
  },
  {
    status: 'Invalidated' as const,
    title: 'Invalidated',
    subtitle: 'Issues to resolve',
  },
  {
    status: 'Live' as const,
    title: 'Live',
    subtitle: 'In assessment',
  },
  {
    status: 'Determined' as const,
    title: 'Determined',
    subtitle: 'Decided cases',
  },
];

export function ApplicationsBoard() {
  const { mutate } = useSWRConfig();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  async function handleCreated(application: ApplicationDto) {
    await mutate(['applications', application.status]);
    setSelectedApplicationId(application.applicationId);
  }

  return (
    <div style={boardWrapper}>
      <div style={boardHeader}>
        <div>
          <h1 style={{ margin: '0 0 8px' }}>Planning Applications</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Track submissions through validation, live assessment, and determination.
          </p>
        </div>
        <NewApplicationForm onCreated={handleCreated} />
      </div>
      <div style={columnsGrid}>
        {COLUMNS.map((column) => (
          <StatusColumn
            key={column.status}
            status={column.status}
            title={column.title}
            subtitle={column.subtitle}
            onSelect={(id) => setSelectedApplicationId(id)}
          />
        ))}
      </div>

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

const boardWrapper: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  padding: '32px 40px 48px',
};

const boardHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  flexWrap: 'wrap',
};

const columnsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 20,
};

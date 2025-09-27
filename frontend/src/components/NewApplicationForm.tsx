'use client';

import type { CSSProperties } from 'react';
import { routes } from '@/lib/navigation';
import { useAppNavigation } from '@/lib/useAppNavigation';

interface Props {
  label?: string;
}

export function NewApplicationForm({ label = '+ New Application' }: Props) {
  const { goTo } = useAppNavigation();
  return (
    <button type="button" style={primaryButton} onClick={() => goTo(routes.applications.new)}>
      {label}
    </button>
  );
}

const primaryButton: CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
};

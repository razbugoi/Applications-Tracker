'use client';

import type { CSSProperties } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function RootLoading() {
  return (
    <div style={wrapper}>
      <LoadingSpinner size="lg" message="Loading view…" />
    </div>
  );
}

const wrapper: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
};

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/navigation';

export default function NotFound() {
  return (
    <div style={wrapper}>
      <div style={card}>
        <h1 style={{ margin: '0 0 12px' }}>Page not found</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', maxWidth: 480 }}>
          The page you are looking for doesn’t exist or may have moved. Try returning to the dashboard to continue
          managing applications.
        </p>
        <Link href={routes.dashboard} style={linkButton}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

const wrapper: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  padding: '0 24px',
};

const card: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  textAlign: 'left',
};

const linkButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 999,
  padding: '10px 20px',
  fontWeight: 600,
  textDecoration: 'none',
};

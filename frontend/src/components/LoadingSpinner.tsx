import type { CSSProperties } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg', number> = {
  sm: 16,
  md: 28,
  lg: 36,
};

export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const dimension = SIZE_MAP[size];

  return (
    <div style={container}>
      <span
        style={{
          ...spinner,
          width: dimension,
          height: dimension,
          borderWidth: Math.max(2, Math.round(dimension / 8)),
        }}
        aria-label="Loading"
      />
      {message && <p style={messageStyle}>{message}</p>}
    </div>
  );
}

const container: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: 24,
};

const spinner: CSSProperties = {
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  borderTopColor: 'var(--primary)',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: 'var(--text-muted)',
  textAlign: 'center',
};
'use client';

import { useState, type ReactNode, type CSSProperties } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface Props {
  children: ReactNode;
}

export function RouteGuard({ children }: Props) {
  const { isAuthenticated, signInWithEmail } = useAuth();
  const bypassAuth = process.env.NEXT_PUBLIC_SUPABASE_BYPASS_AUTH === 'true';

  if (bypassAuth) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <SignInPrompt onSubmit={signInWithEmail} />;
  }

  return <>{children}</>;
}

const guardWrapper: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
};

function SignInPrompt({ onSubmit }: { onSubmit: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      await onSubmit(email);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    }
  }

  return (
    <div style={guardWrapper}>
      <div style={card}>
        <h1 style={{ marginBottom: 16 }}>Sign in</h1>
        <p style={{ marginBottom: 12 }}>Enter your email address and we&apos;ll send you a magic link to access the tracker.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #d1d5db' }}
            />
          </label>
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
        {status === 'sent' ? (
          <p style={{ marginTop: 12 }}>Check your inbox for the sign-in link.</p>
        ) : null}
        {status === 'sending' ? (
          <div style={{ marginTop: 12 }}>
            <LoadingSpinner size="sm" message="Sending magic link…" />
          </div>
        ) : null}
        {error ? (
          <p style={{ marginTop: 12, color: 'var(--danger)' }}>{error}</p>
        ) : null}
      </div>
    </div>
  );
}

const card: CSSProperties = {
  width: 'min(420px, 90vw)',
  background: '#ffffff',
  borderRadius: 12,
  padding: 32,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
};

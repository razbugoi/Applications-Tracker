'use client';

import { useMemo, useState } from 'react';
import { AuthProvider, useAuth } from '@/components/AuthProvider';

type Mode = 'signIn' | 'signUp';

function AuthInner() {
  const { isAuthenticated, user, signInWithPassword, signUpWithPassword, sendMagicLink, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const heading = useMemo(() => (mode === 'signIn' ? 'Sign in (dev)' : 'Sign up (dev)'), [mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);
    try {
      if (mode === 'signIn') {
        await signInWithPassword(email, password);
        setStatus('Signed in successfully. Session will propagate above.');
      } else {
        const result = await signUpWithPassword({ email, password, fullName: fullName.trim() || undefined });
        setStatus(
          result.needsConfirmation
            ? 'Sign up succeeded. Confirm the email to activate the account.'
            : 'Sign up succeeded and session created.'
        );
      }
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }

  async function handleMagicLink() {
    setStatus(null);
    setError(null);
    try {
      await sendMagicLink(email);
      setStatus('Magic link sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send magic link');
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '56px auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1>Supabase Auth Prototype</h1>
      {isAuthenticated ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ marginBottom: 8 }}>
              Signed in as <strong>{user?.email}</strong>
            </p>
            <button type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => setMode('signIn')} disabled={mode === 'signIn'}>
              Sign in
            </button>
            <button type="button" onClick={() => setMode('signUp')} disabled={mode === 'signUp'}>
              Sign up
            </button>
          </div>
          <h2>{heading}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signUp' ? (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                Full name (optional)
                <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit">{mode === 'signIn' ? 'Sign in' : 'Create account'}</button>
              {mode === 'signIn' ? (
                <button type="button" onClick={() => void handleMagicLink()}>
                  Send magic link
                </button>
              ) : null}
            </div>
          </form>
        </>
      )}
      {status ? <p style={{ color: 'green' }}>{status}</p> : null}
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
    </div>
  );
}

export default function SupabaseAuthPrototypePage() {
  return (
    <AuthProvider>
      <AuthInner />
    </AuthProvider>
  );
}

'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/AuthProvider';

function AuthInner() {
  const { isAuthenticated, user, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    try {
      await signInWithEmail(email);
      setStatus('Magic link sent. Check your inbox.');
    } catch (error) {
      if (error instanceof Error) {
        setStatus(error.message);
      } else {
        setStatus('Unable to send magic link, please try again.');
      }
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '56px auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1>Supabase Auth Prototype</h1>
      {isAuthenticated ? (
        <div>
          <p>
            Signed in as <strong>{user?.email}</strong>
          </p>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <button type="submit">Send magic link</button>
        </form>
      )}
      {status ? <p>{status}</p> : null}
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

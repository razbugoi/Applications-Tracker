'use client';

import { useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface Props {
  children: ReactNode;
}

export function RouteGuard({ children }: Props) {
  const { isAuthenticated, isInitialising, signInWithPassword, signUpWithPassword, sendMagicLink } = useAuth();
  const bypassAuth = process.env.NEXT_PUBLIC_SUPABASE_BYPASS_AUTH === 'true';

  if (bypassAuth) {
    return <>{children}</>;
  }

  if (isInitialising) {
    return (
      <div style={loadingWrapper}>
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthenticationCard
        onSignIn={signInWithPassword}
        onSignUp={signUpWithPassword}
        onSendMagicLink={sendMagicLink}
      />
    );
  }

  return <>{children}</>;
}

type AuthCardMode = 'signIn' | 'signUp';

function AuthenticationCard({
  onSignIn,
  onSignUp,
  onSendMagicLink,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (options: { email: string; password: string; fullName?: string }) => Promise<{ needsConfirmation: boolean }>;
  onSendMagicLink: (email: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<AuthCardMode>('signIn');
  const [pendingMode, setPendingMode] = useState<AuthCardMode | null>(null);
  const tabButtons = useMemo(() => (
    [
      { key: 'signIn' as const, label: 'Sign in' },
      { key: 'signUp' as const, label: 'Sign up' },
    ]
  ), []);

  return (
    <div style={guardWrapper}>
      <div style={card}>
        <div style={tabList} role="tablist" aria-label="Authentication tabs">
          {tabButtons.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                style={active ? tabButtonActive : tabButton}
                disabled={pendingMode !== null}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {activeTab === 'signIn' ? (
          <SignInForm
            onSubmit={async (email, password) => {
              setPendingMode('signIn');
              try {
                await onSignIn(email, password);
              } finally {
                setPendingMode(null);
              }
            }}
            onSendMagicLink={async (email) => {
              setPendingMode('signIn');
              try {
                await onSendMagicLink(email);
              } finally {
                setPendingMode(null);
              }
            }}
            disabled={pendingMode !== null}
            onSwitchToSignUp={() => setActiveTab('signUp')}
          />
        ) : (
          <SignUpForm
            onSubmit={async (payload) => {
              setPendingMode('signUp');
              try {
                return await onSignUp(payload);
              } finally {
                setPendingMode(null);
              }
            }}
            disabled={pendingMode !== null}
            onSwitchToSignIn={() => setActiveTab('signIn')}
          />
        )}
      </div>
    </div>
  );
}

function SignInForm({
  onSubmit,
  onSendMagicLink,
  onSwitchToSignUp,
  disabled,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  onSendMagicLink: (email: string) => Promise<void>;
  onSwitchToSignUp: () => void;
  disabled: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [magicStatus, setMagicStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [magicMessage, setMagicMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      setStatus('error');
      setMessage('Enter your email and password to continue.');
      return;
    }
    setStatus('loading');
    setMessage(null);
    try {
      await onSubmit(email, password);
      setStatus('idle');
      setPassword('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    }
  }

  return (
    <>
      <header>
        <h1 style={{ marginBottom: 8 }}>Welcome back</h1>
        <p style={{ marginTop: 0, marginBottom: 24, color: 'var(--text-muted)' }}>
          Sign in with your email and password or request a magic link if you forgot it.
        </p>
      </header>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={fieldLabel}>
          Email address
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={inputStyle}
            disabled={disabled}
            autoComplete="email"
          />
        </label>
        <label style={fieldLabel}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
            disabled={disabled}
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={disabled || status === 'loading'}>
          {status === 'loading' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          onClick={async () => {
            if (!email) {
              setMagicStatus('error');
              setMagicMessage('Enter your email to receive a magic link.');
              return;
            }
            setMagicStatus('loading');
            setMagicMessage(null);
            try {
              await onSendMagicLink(email);
              setMagicStatus('sent');
              setMagicMessage('Magic link sent. Check your inbox.');
            } catch (error) {
              setMagicStatus('error');
              setMagicMessage(error instanceof Error ? error.message : 'Unable to send magic link.');
            }
          }}
          disabled={disabled || magicStatus === 'loading'}
          style={secondaryActionButton}
        >
          {magicStatus === 'loading' ? 'Sending magic link…' : 'Email me a magic link'}
        </button>
        <button type="button" onClick={onSwitchToSignUp} style={linkButton} disabled={disabled}>
          Need an account? Sign up
        </button>
      </div>
      {status === 'loading' ? (
        <div style={{ marginTop: 16 }}>
          <LoadingSpinner size="sm" message="Signing you in…" />
        </div>
      ) : null}
      {message ? (
        <p style={{ marginTop: 12, color: status === 'error' ? 'var(--danger)' : 'inherit' }}>{message}</p>
      ) : null}
      {magicMessage ? (
        <p
          style={{
            marginTop: 4,
            color: magicStatus === 'error' ? 'var(--danger)' : 'var(--success)',
          }}
        >
          {magicMessage}
        </p>
      ) : null}
    </>
  );
}

function SignUpForm({
  onSubmit,
  onSwitchToSignIn,
  disabled,
}: {
  onSubmit: (payload: { email: string; password: string; fullName?: string }) => Promise<{ needsConfirmation: boolean }>;
  onSwitchToSignIn: () => void;
  disabled: boolean;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      setStatus('error');
      setMessage('Please fill in the required fields.');
      return;
    }
    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('loading');
    setMessage(null);
    try {
      const result = await onSubmit({ email, password, fullName: fullName.trim() || undefined });
      setStatus('success');
      setMessage(
        result.needsConfirmation
          ? 'Almost there! Confirm your email via the link we just sent, then sign in.'
          : 'Account created successfully. You can sign in now.'
      );
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : 'Unable to create your account. Please try again.'
      );
    }
  }

  return (
    <>
      <header>
        <h1 style={{ marginBottom: 8 }}>Create an account</h1>
        <p style={{ marginTop: 0, marginBottom: 24, color: 'var(--text-muted)' }}>
          Register to start tracking applications with your team.
        </p>
      </header>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={fieldLabel}>
          Full name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            style={inputStyle}
            disabled={disabled}
            autoComplete="name"
          />
        </label>
        <label style={fieldLabel}>
          Email address
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={inputStyle}
            disabled={disabled}
            autoComplete="email"
          />
        </label>
        <label style={fieldLabel}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
            disabled={disabled}
            autoComplete="new-password"
          />
        </label>
        <label style={fieldLabel}>
          Confirm password
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            style={inputStyle}
            disabled={disabled}
            autoComplete="new-password"
          />
        </label>
        <button type="submit" disabled={disabled || status === 'loading'}>
          {status === 'loading' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <button type="button" onClick={onSwitchToSignIn} style={{ ...linkButton, marginTop: 16 }} disabled={disabled}>
        Already registered? Sign in
      </button>
      {status === 'loading' ? (
        <div style={{ marginTop: 16 }}>
          <LoadingSpinner size="sm" message="Setting up your account…" />
        </div>
      ) : null}
      {message ? (
        <p
          style={{
            marginTop: 12,
            color:
              status === 'error'
                ? 'var(--danger)'
                : status === 'success'
                ? 'var(--success)'
                : 'inherit',
          }}
        >
          {message}
        </p>
      ) : null}
    </>
  );
}

const loadingWrapper: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  width: '100%',
};

const guardWrapper: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  padding: '24px 16px',
};

const card: CSSProperties = {
  width: 'min(460px, 92vw)',
  background: '#ffffff',
  borderRadius: 16,
  padding: 32,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const tabList: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 12,
};

const tabButton: CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#f8fafc',
  color: 'var(--text-muted)',
  fontWeight: 600,
  cursor: 'pointer',
};

const tabButtonActive: CSSProperties = {
  ...tabButton,
  borderColor: 'rgba(37, 99, 235, 0.4)',
  background: 'rgba(37, 99, 235, 0.1)',
  color: 'var(--primary-dark)',
  boxShadow: '0 2px 10px rgba(37, 99, 235, 0.16)',
};

const fieldLabel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 15,
};

const secondaryActionButton: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(37, 99, 235, 0.3)',
  background: '#ffffff',
  color: 'var(--primary-dark)',
  cursor: 'pointer',
  fontWeight: 600,
};

const linkButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--primary-dark)',
  cursor: 'pointer',
  fontWeight: 600,
  textDecoration: 'underline',
  padding: 0,
  alignSelf: 'flex-start',
};

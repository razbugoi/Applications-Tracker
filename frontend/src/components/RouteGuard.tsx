'use client';

import { useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { NavigationBar } from '@/components/NavigationBar';

interface Props {
  children: ReactNode;
}

export function RouteGuard({ children }: Props) {
  const { isAuthenticated, isInitialising, signInWithPassword, signUpWithPassword, sendMagicLink } = useAuth();
  const bypassAuth = process.env.NEXT_PUBLIC_SUPABASE_BYPASS_AUTH === 'true';

  const renderAppShell = (content: ReactNode) => (
    <>
      <NavigationBar />
      <main className="app-shell__main">{content}</main>
    </>
  );

  if (bypassAuth) {
    return renderAppShell(children);
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

  return renderAppShell(children);
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
    <div style={authPage}>
      <header style={authHeader}>
        <h1 style={authTitle}>Planning Application Tracker</h1>
        <p style={authSubtitle}>Stay on top of submissions, issues, and decisions.</p>
      </header>
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
  const domainHint = 'Use your workbyhere.com email address to access the tracker.';

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
        <p style={{ marginTop: 0, marginBottom: 8, color: 'var(--text-muted)' }}>
          Sign in with your email and password or request a magic link if you forgot it.
        </p>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)' }}>{domainHint}</p>
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
        <button
          type="submit"
          disabled={disabled || status === 'loading'}
          style={{
            ...primaryActionButton,
            opacity: disabled || status === 'loading' ? 0.7 : 1,
            cursor: disabled || status === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
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
          style={{
            ...secondaryActionButton,
            opacity: disabled || magicStatus === 'loading' ? 0.7 : 1,
            cursor: disabled || magicStatus === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
          {magicStatus === 'loading' ? 'Sending magic link…' : 'Email me a magic link'}
        </button>
        <button
          type="button"
          onClick={onSwitchToSignUp}
          style={{
            ...linkButton,
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          disabled={disabled}
        >
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
  const domainHint = 'We only allow registrations from workbyhere.com email addresses.';

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
        <p style={{ marginTop: 0, marginBottom: 8, color: 'var(--text-muted)' }}>
          Register to start tracking applications with your team.
        </p>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)' }}>{domainHint}</p>
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
        <button
          type="submit"
          disabled={disabled || status === 'loading'}
          style={{
            ...primaryActionButton,
            opacity: disabled || status === 'loading' ? 0.7 : 1,
            cursor: disabled || status === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'loading' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <button
        type="button"
        onClick={onSwitchToSignIn}
        style={{
          ...linkButton,
          marginTop: 16,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        disabled={disabled}
      >
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
  minHeight: '100vh',
  width: '100%',
};

const authPage: CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '72px 16px',
  gap: 32,
  background: 'linear-gradient(180deg, #eef2ff 0%, #ffffff 55%)',
};

const authHeader: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 8,
  maxWidth: 520,
};

const authTitle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1.1,
  fontWeight: 700,
  color: 'var(--text)',
};

const authSubtitle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  color: 'var(--text-muted)',
};

const card: CSSProperties = {
  width: 'min(440px, 92vw)',
  background: '#ffffff',
  borderRadius: 20,
  padding: 36,
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.14)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  border: '1px solid rgba(99, 102, 241, 0.12)',
};

const tabList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  padding: 4,
  borderRadius: 12,
  background: 'rgba(99, 102, 241, 0.08)',
  gap: 4,
};

const tabButton: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'transparent',
  color: 'rgba(30, 41, 59, 0.65)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const tabButtonActive: CSSProperties = {
  ...tabButton,
  background: '#ffffff',
  color: '#1d4ed8',
  boxShadow: '0 6px 16px rgba(37, 99, 235, 0.18)',
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
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

const secondaryActionButton: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(59, 130, 246, 0.35)',
  background: '#f8fafc',
  color: '#1d4ed8',
  fontWeight: 600,
  transition: 'all 0.2s ease',
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

const primaryActionButton: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  transition: 'all 0.2s ease',
  boxShadow: '0 12px 25px rgba(37, 99, 235, 0.25)',
};

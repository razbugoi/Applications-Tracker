'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

const ALLOWED_EMAIL_DOMAIN = 'workbyhere.com';

function assertAllowedEmail(email: string) {
  const normalised = email.trim().toLowerCase();
  const atIndex = normalised.lastIndexOf('@');
  if (atIndex === -1) {
    throw new Error('Enter a valid workbyhere.com email address.');
  }
  const domain = normalised.slice(atIndex + 1);
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    throw new Error('Only workbyhere.com email addresses are allowed.');
  }
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitialising: boolean;
  user: User | null;
  session: Session | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (options: { email: string; password: string; fullName?: string }) => Promise<{ needsConfirmation: boolean }>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch (error) {
      console.error('Supabase client initialisation failed', error);
      return undefined;
    }
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitialising, setIsInitialising] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsInitialising(false);
      return;
    }
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((error) => {
        console.error('Failed to resolve Supabase session', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsInitialising(false);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      newSession: Session | null,
    ) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsInitialising(false);
    });

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, [supabase]);

  const value: AuthContextValue = {
    isAuthenticated: Boolean(user),
    isInitialising,
    user,
    session,
    async signInWithPassword(email: string, password: string) {
      if (!supabase) {
        throw new Error('Supabase client unavailable');
      }
      assertAllowedEmail(email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
    },
    async signUpWithPassword({ email, password, fullName }) {
      if (!supabase) {
        throw new Error('Supabase client unavailable');
      }
      assertAllowedEmail(email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: fullName ? { full_name: fullName } : undefined,
        },
      });
      if (error) {
        throw error;
      }
      const needsConfirmation = !data?.user?.email_confirmed_at;
      return { needsConfirmation };
    },
    async sendMagicLink(email: string) {
      if (!supabase) {
        throw new Error('Supabase client unavailable');
      }
      assertAllowedEmail(email);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        throw error;
      }
    },
    async signOut() {
      if (!supabase) {
        throw new Error('Supabase client unavailable');
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

interface AuthContextValue {
  isAuthenticated: boolean;
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

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let isMounted = true;

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!isMounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      newSession: Session | null,
    ) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, [supabase]);

  const value: AuthContextValue = {
    isAuthenticated: Boolean(user),
    user,
    session,
    async signInWithPassword(email: string, password: string) {
      if (!supabase) {
        throw new Error('Supabase client unavailable');
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
    },
    async signUpWithPassword({ email, password, fullName }) {
      if (!supabase) {
        throw new Error('Supabase client unavailable');
      }
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

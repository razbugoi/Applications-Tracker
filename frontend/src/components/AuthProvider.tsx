'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import type { AuthUser } from 'aws-amplify/auth';
import { isAmplifyConfigured, isAuthBypassed } from '@/lib/amplifyClient';
import '@aws-amplify/ui-react/styles.css';

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  signOut?: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  user: null,
  signOut: undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const shouldUseAuth = !isAuthBypassed && isAmplifyConfigured;

  if (!shouldUseAuth) {
    if (!isAuthBypassed && !isAmplifyConfigured) {
      console.warn('Amplify auth is not configured. Falling back to unauthenticated mode.');
    }
    return (
      <AuthContext.Provider value={{ isAuthenticated: false, user: null, signOut: undefined }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <AuthContext.Provider value={{ isAuthenticated: true, user: user ?? null, signOut }}>
          {children}
        </AuthContext.Provider>
      )}
    </Authenticator>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

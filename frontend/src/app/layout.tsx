"use client";

import './globals.css';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteGuard } from '@/components/RouteGuard';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NavigationProvider>
            <ErrorBoundary>
              <div className="app-shell">
                <RouteGuard>{children}</RouteGuard>
              </div>
            </ErrorBoundary>
          </NavigationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

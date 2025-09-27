"use client";

import './globals.css';
import type { ReactNode } from 'react';
import { NavigationBar } from '@/components/NavigationBar';
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
                <NavigationBar />
                <RouteGuard>
                  <main className="app-shell__main">{children}</main>
                </RouteGuard>
              </div>
            </ErrorBoundary>
          </NavigationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

"use client";

import './globals.css';
import type { ReactNode } from 'react';
import { NavigationBar } from '@/components/NavigationBar';
import { AuthProvider } from '@/components/AuthProvider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-shell">
            <NavigationBar />
            <main className="app-shell__main">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

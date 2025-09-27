'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/components/AuthProvider';
import type { User } from '@supabase/supabase-js';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/applications', label: 'Applications' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/outcomes', label: 'Outcome Summary' },
  { href: '/issues', label: 'Issues' },
] satisfies Array<{ href: Route; label: string }>;

export function NavigationBar() {
  const pathname = usePathname();
  const { isAuthenticated, user, signOut } = useAuth();
  const userLabel = getUserLabel(user);

  return (
    <header className="app-shell__header">
      <div className="app-shell__header-inner">
        <div className="app-shell__brand">
          <span className="app-shell__title">Planning Application Tracker</span>
          <span className="app-shell__subtitle">Stay on top of submissions, issues, and decisions.</span>
        </div>
        <div className="app-shell__nav-wrapper">
          <nav aria-label="Primary" className="app-shell__nav">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link'}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {isAuthenticated && signOut && (
            <div className="app-shell__actions">
              {userLabel ? <span className="app-shell__user">{userLabel}</span> : null}
              <button type="button" className="app-shell__signout" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function getUserLabel(user: User | null): string | null {
  if (!user) {
    return null;
  }
  return user.email ?? user.user_metadata?.full_name ?? user.id ?? null;
}

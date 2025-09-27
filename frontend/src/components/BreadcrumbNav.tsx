'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Route } from 'next';
import { useNavigation } from '@/contexts/NavigationContext';

export function BreadcrumbNav() {
  const {
    state: { breadcrumbs },
  } = useNavigation();

  if (!breadcrumbs || breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" style={breadcrumbNav}>
      <ol style={breadcrumbList}>
        {breadcrumbs.map((crumb, index) => (
          <li key={`${crumb.href}-${crumb.label}`} style={breadcrumbItem}>
            {crumb.isActive ? (
              <span style={breadcrumbActive} aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link<Route> href={crumb.href} style={breadcrumbLink}>
                {crumb.label}
              </Link>
            )}
            {index < breadcrumbs.length - 1 && (
              <span style={breadcrumbSeparator} aria-hidden="true">
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const breadcrumbNav: CSSProperties = {
  padding: '12px 0',
  borderBottom: '1px solid var(--border)',
  marginBottom: '24px',
};

const breadcrumbList: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  listStyle: 'none',
  margin: 0,
  padding: 0,
  fontSize: 13,
};

const breadcrumbItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const breadcrumbLink: CSSProperties = {
  color: 'var(--primary)',
  textDecoration: 'none',
  fontWeight: 600,
};

const breadcrumbActive: CSSProperties = {
  color: 'var(--text)',
  fontWeight: 700,
};

const breadcrumbSeparator: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 12,
};
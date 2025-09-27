'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { routes } from '@/lib/navigation';

export function useAppNavigation() {
  const router = useRouter();

  const goTo = useCallback(
    (path: Route) => {
      trackClientNavigation(path);
      router.push(path);
    },
    [router]
  );

  const goToApplication = useCallback(
    (id: string, view?: 'edit' | 'issues' | 'timeline') => {
      let path: Route = routes.applications.detail(id);
      if (view === 'edit') {
        path = routes.applications.edit(id);
      } else if (view === 'issues') {
        path = routes.applications.issues(id);
      } else if (view === 'timeline') {
        path = routes.applications.timeline(id);
      }
      goTo(path);
    },
    [goTo]
  );

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(routes.dashboard);
    }
  }, [router]);

  return { goTo, goToApplication, goBack };
}

function trackClientNavigation(path: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const analytics = (window as any).analytics;
  if (analytics && typeof analytics.track === 'function') {
    analytics.track('route_change', { path });
  }
  const dataLayer = (window as any).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: 'route_change', path });
  }
}

'use client';

import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { ApplicationsBoard } from '@/components/ApplicationsBoard';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { useNavigation } from '@/contexts/NavigationContext';
import { routes } from '@/lib/navigation';

export function ApplicationsBoardPage() {
  const { dispatch } = useNavigation();

  useEffect(() => {
    dispatch({
      type: 'SET_BREADCRUMBS',
      payload: [
        { label: 'Dashboard', href: routes.dashboard, isActive: false },
        { label: 'Applications', href: routes.applications.index, isActive: true },
      ],
    });
    dispatch({ type: 'CLEAR_APPLICATION' });
    return () => {
      dispatch({ type: 'SET_BREADCRUMBS', payload: [] });
    };
  }, [dispatch]);

  return (
    <div style={pageShell}>
      <BreadcrumbNav />
      <ApplicationsBoard />
    </div>
  );
}

const pageShell: CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

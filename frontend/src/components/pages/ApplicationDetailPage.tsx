'use client';

import { useEffect, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ApplicationDetailPanel } from '@/components/ApplicationDetailPanel';
import { useNavigation, buildBreadcrumbs } from '@/contexts/NavigationContext';
import { fetchApplication, SWR_KEYS } from '@/lib/api';
import { useAppNavigation } from '@/lib/useAppNavigation';

interface Props {
  applicationId: string;
}

export function ApplicationDetailPage({ applicationId }: Props) {
  const pathname = usePathname();
  const { state, dispatch } = useNavigation();
  const { isLoading, error, data } = useApplication(applicationId);
  const { goBack } = useAppNavigation();

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, [dispatch, isLoading]);

  useEffect(() => {
    if (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } else if (data) {
      dispatch({ type: 'SET_APPLICATION', payload: data.application });
      const breadcrumbs = buildBreadcrumbs(data.application, pathname);
      dispatch({ type: 'SET_BREADCRUMBS', payload: breadcrumbs });
    }
  }, [dispatch, data, error, pathname]);

  useEffect(() => {
    return () => {
      dispatch({ type: 'CLEAR_APPLICATION' });
      dispatch({ type: 'SET_BREADCRUMBS', payload: [] });
    };
  }, [dispatch]);

  if (isLoading) {
    return (
      <div style={pageShell}>
        <BreadcrumbNav />
        <div style={loadingWrapper}>
          <LoadingSpinner size="lg" message="Loading application…" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={pageShell}>
        <BreadcrumbNav />
        <div style={errorContainer}>
          <h1 style={errorTitle}>Application not found</h1>
          <p style={errorMessage}>The application you are looking for might have been removed or you may not have access.</p>
          <button type="button" style={backButton} onClick={goBack}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageShell}>
      <BreadcrumbNav />
      <div style={contentWrapper}>
        <ApplicationDetailPanel applicationId={applicationId} />
      </div>
    </div>
  );
}

function useApplication(applicationId: string) {
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.applicationAggregate(applicationId),
    () => fetchApplication(applicationId)
  );

  return {
    data,
    isLoading,
    error: error instanceof Error ? error : error ? new Error('Failed to load application') : null,
  };
}

const pageShell: CSSProperties = {
  maxWidth: 1180,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const loadingWrapper: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '64px 0',
};

const contentWrapper: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
};

const errorContainer: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 32,
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  alignItems: 'flex-start',
};

const errorTitle: CSSProperties = {
  margin: 0,
  fontSize: 24,
};

const errorMessage: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted)',
  maxWidth: 520,
};

const backButton: CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
};

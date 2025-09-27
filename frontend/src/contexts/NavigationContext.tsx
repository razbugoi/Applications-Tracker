'use client';

import { createContext, useContext, useReducer, useMemo, type ReactNode, type Dispatch } from 'react';
import type { Route } from 'next';
import type { ApplicationDto } from '@/lib/api';
import { routes } from '@/lib/navigation';

export interface BreadcrumbItem {
  label: string;
  href: Route;
  isActive: boolean;
}

interface NavigationState {
  currentApplication: ApplicationDto | null;
  breadcrumbs: BreadcrumbItem[];
  isLoading: boolean;
  error: string | null;
  previousRoute: string | null;
}

type NavigationAction =
  | { type: 'SET_APPLICATION'; payload: ApplicationDto }
  | { type: 'SET_BREADCRUMBS'; payload: BreadcrumbItem[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PREVIOUS_ROUTE'; payload: string }
  | { type: 'CLEAR_APPLICATION' };

const initialState: NavigationState = {
  currentApplication: null,
  breadcrumbs: [],
  isLoading: false,
  error: null,
  previousRoute: null,
};

function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'SET_APPLICATION':
      return { ...state, currentApplication: action.payload, error: null };
    case 'SET_BREADCRUMBS':
      return { ...state, breadcrumbs: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PREVIOUS_ROUTE':
      return { ...state, previousRoute: action.payload };
    case 'CLEAR_APPLICATION':
      return { ...state, currentApplication: null, breadcrumbs: [], error: null };
    default:
      return state;
  }
}

const NavigationContext = createContext<{ state: NavigationState; dispatch: Dispatch<NavigationAction> } | null>(
  null
);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(navigationReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

export function buildBreadcrumbs(application: ApplicationDto | null, currentPath: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', href: routes.dashboard, isActive: currentPath === routes.dashboard },
  ];

  if (!application) {
    return breadcrumbs;
  }

  const detailHref = routes.applications.detail(application.applicationId);
  const editHref = routes.applications.edit(application.applicationId);
  const issuesHref = routes.applications.issues(application.applicationId);
  const timelineHref = routes.applications.timeline(application.applicationId);

  const baseCrumb: BreadcrumbItem = {
    label: application.prjCodeName,
    href: detailHref,
    isActive: currentPath === detailHref,
  };
  breadcrumbs.push(baseCrumb);

  if (currentPath === editHref) {
    breadcrumbs.push({
      label: 'Edit',
      href: editHref,
      isActive: true,
    });
  } else if (currentPath === issuesHref) {
    breadcrumbs.push({
      label: 'Issues',
      href: issuesHref,
      isActive: true,
    });
  } else if (currentPath === timelineHref) {
    breadcrumbs.push({
      label: 'Timeline',
      href: timelineHref,
      isActive: true,
    });
  }

  return breadcrumbs;
}
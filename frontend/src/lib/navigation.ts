import type { Route } from 'next';

export const routes = {
  dashboard: '/' as Route,
  applications: {
    index: '/applications' as Route,
    detail: (id: string) => `/applications/${id}` as Route,
    edit: (id: string) => `/applications/${id}/edit` as Route,
    issues: (id: string) => `/applications/${id}/issues` as Route,
    timeline: (id: string) => `/applications/${id}/timeline` as Route,
    new: '/applications/new' as Route,
  },
  status: {
    submitted: '/submitted' as Route,
    invalidated: '/invalidated' as Route,
    live: '/live' as Route,
    determined: '/determined' as Route,
  },
  issues: '/issues' as Route,
  calendar: '/calendar' as Route,
  outcomes: '/outcomes' as Route,
} as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidApplicationId(id: string): boolean {
  return UUID_REGEX.test(id);
}

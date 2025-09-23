import type { Route } from 'next';

export function applicationRoute(id: string): Route {
  return `/applications/${id}` as Route;
}

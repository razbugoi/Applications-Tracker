# Implementation Guide – Supabase App Router

This guide summarises how the Vercel + Supabase stack is wired together so future enhancements follow the established patterns.

## Overview
- **Framework**: Next.js 14 App Router deployed on Vercel.
- **State Management**: React Server Components with client-side hooks (SWR) for realtime UI updates.
- **Auth**: Supabase magic links. Sessions managed via `@supabase/auth-helpers-nextjs` with providers in `frontend/src/components/AuthProvider.tsx`.
- **Data Access**: Server-side helpers wrap Supabase clients to ensure service-role credentials stay on the server. Client components call internal API routes or use anon key with strict RLS.

## Key Modules
- `src/lib/supabaseServerClient.ts`: Creates a Supabase client scoped to the incoming request (server actions, API routes).
- `src/lib/supabaseBrowserClient.ts`: Browser-safe client using anon key; relies on RLS for security.
- `src/lib/api.ts`: Shared fetch helpers for calling `/api` routes (e.g., applications, issues) with consistent error handling.
- `src/components/RouteGuard.tsx`: Protects client routes by redirecting unauthenticated users to Supabase auth flow.
- `src/components/pages/`: Server components that load initial data (applications board, calendar, outcomes) before hydrating client widgets.

## Auth Flow
1. `AuthProvider` wraps the app layout. It listens to Supabase auth state changes and stores the session in a React context.
2. Protected routes check `session` to show content or redirect to `/auth/sign-in` (handled by Supabase Hosted UI or custom page).
3. API routes validate the `req.headers.authorization` bearer token supplied by `supabaseServerClient` to act on behalf of the user.

## Data Fetching Patterns
- **Server Components**: Use `createServerClient` helpers to fetch data during render:
  ```ts
  import { getSupabaseServerClient } from '@/lib/supabaseServerClient';

  export default async function ApplicationsPage() {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.from('applications').select('*').order('submission_date', { ascending: false });
    return <ApplicationsBoard initialApplications={data ?? []} />;
  }
  ```
- **Client Components**: Use SWR with API routes to benefit from caching and avoid exposing service-role key:
  ```ts
  const { data, isLoading } = useSWR('/api/applications', fetchJson<ApplicationSummary[]>, {
    revalidateOnFocus: false,
  });
  ```
- **Mutations**: Client components call API routes (e.g., `POST /api/applications`) which in turn use the server client with service-role key to perform privileged inserts/updates.

## Styling & UI
- Components live under `src/components/` and are split between reusable UI elements and page-specific sections (`src/components/pages/`).
- Loading states are handled via Suspense + `frontend/src/app/loading.tsx` spinner component.
- Errors bubble through `frontend/src/components/ErrorBoundary.tsx` for user-friendly messaging.

## Adding New Features
1. **Define schema**: Create a Supabase migration under `supabase/migrations/` (SQL). Run `supabase db push` locally.
2. **Update types**: Add TypeScript types under `src/types/` mirroring the new columns/tables (consider generating via Supabase typegen).
3. **Server helpers**: Extend API routes or server components to query/ mutate the new data.
4. **Client UI**: Build components with SWR hooks and optimistic updates as needed.
5. **Tests**: Add Playwright coverage in `frontend/tests/` and optional integration tests hitting Supabase local stack.

## Environment Management
- Keep `.env.local` for local development. Do not commit secrets.
- Use `scripts/generate-frontend-env.sh` when rotating Supabase keys to ensure `.env` files stay consistent.
- Production secrets live in Vercel (Settings → Environment Variables). Limit service-role key access to trusted maintainers.

## Operational Notes
- Health checks: `scripts/health-check.js` pings the deployed API and Supabase to confirm connectivity.
- Error logging: rely on Vercel function logs and Supabase Log Explorer; attach alerts when thresholds exceeded.
- Rollbacks: Vercel `vercel rollback` + Supabase PITR (see `docs/deployment-strategy.md`).

Review this guide alongside `docs/architecture.md` and update as the codebase evolves (e.g., if we adopt TRPC, React Query, or Supabase Edge Functions).

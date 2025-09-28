# Application Tracker Review Findings

## High-Risk Issues

- **Unauthenticated API surface exposes privileged Supabase operations.** None of the Next.js API route handlers validate an authenticated Supabase session or team membership before invoking the service layer. Endpoints like `POST /api/applications` and `GET /api/issues` can therefore be called by anyone who can reach the deployment, yet they call into the service layer that uses the Supabase service-role key and bypasses Row Level Security, allowing arbitrary creation, enumeration, and modification of production data.【F:frontend/src/app/api/applications/route.ts†L34-L79】【F:frontend/src/app/api/issues/route.ts†L1-L17】【F:frontend/src/server/repositories/supabaseRepository.ts†L85-L303】
- **Service-role key fragments are written to logs.** `SupabaseRepository.createApplication` logs the Supabase URL and the first characters of the service-role key. Even a partial leak of the key is sensitive, and Vercel/server logs are broadly accessible to operators; attackers routinely reconstruct full secrets from leaked prefixes combined with brute force or social engineering.【F:frontend/src/server/repositories/supabaseRepository.ts†L91-L120】

## Medium-Risk / Functional Gaps

- **Authentication guard flashes the sign-in form on every load.** `RouteGuard` renders the credential form whenever `isAuthenticated` is false, but `AuthProvider` initialises that flag to `false` until Supabase resolves the session asynchronously. The result is a visible flash of the login UI (and an unnecessary OTP email prompt) for already-signed-in users, especially on slower connections.【F:frontend/src/components/AuthProvider.tsx†L19-L112】【F:frontend/src/components/RouteGuard.tsx†L11-L30】
- **Column views silently truncate at 25 records.** The service-layer `listApplications` hardcodes a default limit of 25 without exposing pagination to the UI. Status columns call this helper directly, so anything beyond the first 25 submissions per status never appears, giving teams an incomplete view of their workload.【F:frontend/src/server/services/applicationService.ts†L142-L144】【F:frontend/src/components/StatusColumn.tsx†L16-L45】

## Recommendations

1. Protect every API route with Supabase session enforcement (e.g. `createRouteHandlerClient`) and authorisation checks against the active team before touching the repository. Consider using Supabase RLS with anon/service-role split so that API handlers can operate with end-user tokens instead of the service key.
2. Remove the sensitive logging from `SupabaseRepository` and rely on structured error handling/metrics instead. If diagnostics are required, emit only anonymised identifiers.
3. Extend `RouteGuard` with a loading state that waits for the initial session probe before deciding whether to render the auth card or the protected children.
4. Introduce pagination parameters (limit/offset or cursor) end-to-end for `listApplications`, and surface UI affordances so that planners can access the full dataset.

These changes will close the most critical security gaps and improve day-to-day usability for authenticated users.

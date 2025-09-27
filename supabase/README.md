# Supabase Project Setup

This directory captures the configuration, migrations, and tooling required for the Vercel + Supabase migration.

## Prerequisites
- Supabase account with a Free or Pro project slot available.
- Supabase CLI `>=1.174.0` (`brew install supabase/tap/supabase` or download from https://supabase.com/docs/guides/cli).
- Docker Desktop (for running the local Supabase stack via `supabase start`).
- Node.js 20.x (shared with the Next.js frontend) for executing migration scripts.

## Project Creation Checklist
1. Sign in to the Supabase dashboard and create a project named **Planning Tracker** (or reuse an existing sandbox).
2. Record the project reference (a short hash like `abcd1234`) and the generated Postgres password.
3. Invite the core team members (product owner, tech lead, developer accounts) with the **Developer** role.
4. Create the following API keys and note them for environment configuration:
   - `anon` public API key
   - `service_role` key (server-side only)
5. Enable email-based sign-in (magic links or password) under **Authentication → Providers** and restrict redirect URLs to:
   - `http://localhost:3000`
   - `https://<your-vercel-preview-domain>`
   - `https://<your-production-domain>`

## CLI Bootstrap
Initialise the local CLI project (runs once):

```bash
supabase init
supabase link --project-ref <project-ref>
```

After linking, you can run migrations and manage database schema with:

```bash
# Apply local migrations to the remote database
supabase db push

# Generate a new timestamped migration from SQL
supabase migration new name_of_change
```

The `supabase/config.toml` file (checked into the repo) stores the linked project reference for repeatable workflows.

## Local Development Stack
To run a local Postgres + Studio stack that mirrors Supabase:

```bash
supabase start
# Expose local connection details to the Next.js app
cp frontend/.env.supabase.example frontend/.env.local
vercel dev
```

This launches Postgres on `localhost:54322` with credentials saved under `.supabase`. Supabase Studio becomes available at `http://localhost:54323` for inspecting tables and auth.

## Environment Variables
Populate the following variables in Vercel/Supabase environments (see `frontend/.env.supabase.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (optional direct Postgres connection string for migrations/tests)
- `SUPABASE_JWT_SECRET` (available in Supabase project settings)
- `SUPABASE_DEFAULT_TEAM_ID` (UUID of the seed team record, defaults to `00000000-0000-0000-0000-000000000001`)

## Next Steps
Once the project is linked:
1. Apply the migrations in `supabase/migrations/` to create the Postgres schema.
2. Run the data migration tooling in `scripts/supabase-migrate/` (added in later phases) to move DynamoDB data across.
3. Deploy the Next.js application to Vercel with the Supabase environment variables configured per environment (development, preview, production).

Keep this document up to date as the Supabase project evolves.

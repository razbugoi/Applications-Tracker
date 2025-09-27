# Data Model & Workflow (Supabase)

The planning tracker now uses a relational schema hosted in Supabase Postgres. All tables include `created_at`/`updated_at` timestamps managed by triggers and are partitioned by `team_id` to support Row Level Security (RLS).

## Core Tables

### applications
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key generated with `gen_random_uuid()` |
| `team_id` | `uuid` | FK to `teams.id`; RLS checks this value |
| `created_by` | `uuid` | Optional FK to `profiles.user_id` |
| `prj_code_name` | `text` | Combined project code + descriptive name |
| `pp_reference` | `text` | Planning portal reference (unique per team) |
| `lpa_reference` | `text` | Local planning authority reference |
| `description` | `text` | Longform summary |
| `council` | `text` | Council / authority name |
| `status` | `application_status` | Enum: `Submitted`, `Invalidated`, `Live`, `Determined` |
| `outcome` | `application_outcome` | Enum: `Pending`, `Approved`, `Refused`, `Withdrawn`, `NotApplicable` |
| `submission_date` | `date` | Initial submission |
| `validation_date` | `date` | Set when application validated |
| `determination_date` | `date` | Planned/actual decision date |
| `eot_date` | `date` | Extension of Time agreement |
| `case_officer` | `text` | Officer name |
| `case_officer_email` | `text` | Officer contact |
| `planning_portal_url` | `text` | Optional deep link |
| `notes` | `text` | Internal notes |
| `issues_count` | `int4` | Maintained by trigger based on `issues` table |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated via trigger |

### issues
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `application_id` | `uuid` | FK to `applications.id` |
| `pp_reference` | `text` | Denormalised for quick lookups |
| `prj_code_name` | `text` | Denormalised for reporting |
| `category` | `issue_category` | Enum: `Validation`, `Technical`, `Design`, `Documentation`, `Policy`, `Other` |
| `status` | `issue_status` | Enum: `Open`, `InProgress`, `Resolved`, `Closed` |
| `title` | `text` | Short summary |
| `description` | `text` | Detailed notes |
| `raised_by` | `text` | Who raised the issue |
| `assigned_to` | `text` | Owner within team |
| `date_raised` | `date` | When issue recorded |
| `due_date` | `date` | Target resolution date |
| `resolution_notes` | `text` | Completion notes |
| `date_resolved` | `date` | When status becomes `Resolved` or `Closed` |
| `created_at` / `updated_at` | `timestamptz` | Managed by trigger |

### timeline_events
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `application_id` | `uuid` | FK to `applications.id` |
| `stage` | `application_status` | Mirrors lifecycle stage |
| `event` | `text` | Human-readable label (`Submission`, `Validation`, `Decision Issued`, etc.) |
| `details` | `text` | Optional metadata |
| `occurred_at` | `timestamptz` | Event timestamp |
| `duration_days` | `int4` | Optional analytics metric |
| `created_at` / `updated_at` | `timestamptz` | Managed by trigger |

### extensions_of_time
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `application_id` | `uuid` | FK to `applications.id` |
| `pp_reference` | `text` | Denormalised |
| `prj_code_name` | `text` | Denormalised |
| `requested_date` | `date` | Date requested from authority |
| `agreed_date` | `date` | Confirmed deadline extension |
| `notes` | `text` | Additional commentary |
| `created_at` / `updated_at` | `timestamptz` | Managed by trigger |

### teams & profiles
- `teams` defines organisational boundaries. The default migration seeds a single team `Default Planning Team` (UUID `00000000-0000-0000-0000-000000000001`).
- `profiles` is a 1:1 extension of `auth.users` storing `team_id`, `email`, `full_name`, and `role`. Triggers ensure new Supabase users receive a profile row and are attached to the default team unless specified.

## Relationships & Access Patterns
- `issues`, `timeline_events`, and `extensions_of_time` cascade on delete with `ON DELETE CASCADE` tied to the parent application.
- Queries favour Supabase's PostgREST filters:
  - List live applications: `GET /rest/v1/applications?status=eq.Live&order=submission_date.desc`.
  - Fetch full detail: Next.js API route hydrates application + related data using a single Postgres RPC or batched select.
  - Issues board: `GET /rest/v1/issues?status=in.(Open,InProgress)&order=due_date.asc`.
- Materialised counters (`issues_count`) maintained via database triggers defined in `supabase/migrations/20240927120000_issue_counter.sql`.

## Workflow States (Application Lifecycle)
1. **Submitted** – Default state when a row is created. Timeline event `Submission` recorded automatically.
2. **Invalidated** – Set when validation fails; associated issues capture remediation tasks.
3. **Live** – Applications with validation complete and outstanding issues resolved. Transition records `Validated` timeline event.
4. **Determined** – Final decision captured with `outcome` + `determination_date`; timeline event `Decision Issued` appended.
5. **Extensions of Time** – Optional rows tracked per application. Upcoming deadlines surface in the calendar view.

## Validation Rules & Triggers
- Check constraints ensure `determination_date >= submission_date` when both populated.
- Issue trigger enforces that moving to `Resolved`/`Closed` requires `resolution_notes` and `date_resolved`.
- RLS policies (see `supabase/migrations/*policy.sql`) restrict all reads/writes to rows matching the authenticated user's `team_id`.

## API Integration
- The Next.js server uses `@supabase/auth-helpers-nextjs` with server-side clients (see `frontend/src/lib/supabaseServerClient.ts`) to perform privileged operations.
- Client-side components rely on the anon key and RLS for scoped queries (SWR fetchers call `/api/*` to avoid leaking service-role credentials).

For a visual schema, refer to `docs/supabase-erd.md`. Update this document whenever migrations introduce new tables or enums.

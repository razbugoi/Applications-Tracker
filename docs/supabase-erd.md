# Supabase Relational Model

```
+---------------------+         +-----------------------+
| applications        |1       *| issues                |
|---------------------|---------|-----------------------|
| id (uuid, pk)       |         | id (uuid, pk)         |
| team_id (uuid, fk)  |         | application_id (uuid) |
| created_by (uuid)   |         | pp_reference (text)   |
| prj_code_name (text)|         | prj_code_name (text)  |
| pp_reference (text) |         | lpa_reference (text)  |
| lpa_reference (text)|         | title (text)          |
| description (text)  |         | category (issue_cat)  |
| council (text)      |         | status (issue_status) |
| submission_date     |         | description (text)    |
| validation_date     |         | raised_by (text)      |
| determination_date  |         | assigned_to (text)    |
| eot_date            |         | due_date (date)       |
| status (app_status) |         | resolution_notes      |
| outcome (app_outcome)|        | date_raised (date)    |
| notes (text)        |         | date_resolved (date)  |
| issues_count (int)  |         | created_at (timestamptz) |
| case_officer        |         | updated_at (timestamptz) |
| case_officer_email  |         +-----------------------+
| planning_portal_url |
| created_at          |        +-----------------------+
| updated_at          |1       *| timeline_events       |
+---------------------+---------|-----------------------|
                                | id (uuid, pk)         |
                                | application_id (uuid) |
                                | stage (app_status)    |
                                | event (text)          |
                                | details (text)        |
                                | occurred_at (timestamptz)|
                                | duration_days (int)    |
                                +-----------------------+

+-----------------------+
| extensions_of_time    |
|-----------------------|
| id (uuid, pk)         |
| application_id (uuid) |
| pp_reference (text)   |
| prj_code_name (text)  |
| requested_date (date) |
| agreed_date (date)    |
| notes (text)          |
| created_at            |
| updated_at            |
+-----------------------+

+-----------------------+          +------------------------+
| teams                 |1        *| profiles               |
|-----------------------|----------|------------------------|
| id (uuid, pk)         |          | user_id (uuid, pk)     |
| name (text)           |          | team_id (uuid, fk)     |
| slug (text, unique)   |          | email (text)           |
| created_at            |          | full_name (text)       |
| updated_at            |          | role (text)            |
+-----------------------+          | created_at             |
                                   | updated_at             |
                                   +------------------------+
```

## Notes
- `auth.users` retains canonical identity; `profiles.user_id` references it 1:1.
- `applications.team_id` partitions data for Row Level Security (RLS). All child tables inherit access control through policies referencing the parent `applications` row.
- Enumerations:
  - `application_status`: `Submitted`, `Invalidated`, `Live`, `Determined`.
  - `application_outcome`: `Pending`, `Approved`, `Refused`, `Withdrawn`, `NotApplicable`.
  - `issue_status`: `Open`, `In Progress`, `Resolved`, `Closed`.
  - `issue_category`: `Validation`, `Technical`, `Design`, `Documentation`, `Policy`, `Other`.
- Derived counters (`applications.issues_count`) maintained by SQL triggers when issues are created/updated (implemented in migrations).
- Timeline events capture every state transition; optional `duration_days` remains NULL until analytics features require population.
- `teams.slug` enables friendly URLs or multi-tenancy in future. For the initial migration all users share the default team record.

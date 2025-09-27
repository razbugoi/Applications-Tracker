-- Initial schema for Planning Tracker on Supabase
set check_function_bodies = off;

create extension if not exists "pgcrypto" with schema public;

create type application_status as enum ('Submitted', 'Invalidated', 'Live', 'Determined');
create type application_outcome as enum ('Pending', 'Approved', 'Refused', 'Withdrawn', 'NotApplicable');
create type issue_status as enum ('Open', 'In Progress', 'Resolved', 'Closed');
create type issue_category as enum ('Validation', 'Technical', 'Design', 'Documentation', 'Policy', 'Other');

create table public.teams (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    email text not null unique,
    full_name text,
    role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.applications (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    created_by uuid references auth.users(id) on delete restrict,
    prj_code_name text not null,
    pp_reference text not null,
    lpa_reference text,
    description text not null,
    council text not null,
    submission_date date not null,
    validation_date date,
    determination_date date,
    eot_date date,
    status application_status not null default 'Submitted',
    outcome application_outcome not null default 'Pending',
    notes text,
    issues_count integer not null default 0,
    case_officer text,
    case_officer_email text,
    planning_portal_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index applications_pp_reference_key on public.applications (pp_reference);
create index applications_team_status_submission_idx on public.applications (team_id, status, submission_date desc);
create index applications_team_council_idx on public.applications (team_id, council);

create table public.issues (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications(id) on delete cascade,
    pp_reference text not null,
    prj_code_name text,
    lpa_reference text,
    title text not null,
    category issue_category not null default 'Validation',
    description text not null,
    raised_by text,
    date_raised date not null,
    assigned_to text,
    status issue_status not null default 'Open',
    due_date date,
    resolution_notes text,
    date_resolved date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index issues_application_status_idx on public.issues (application_id, status);
create index issues_due_date_idx on public.issues (due_date);

create table public.timeline_events (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications(id) on delete cascade,
    stage application_status not null,
    event text not null,
    details text,
    occurred_at timestamptz not null default now(),
    duration_days integer,
    created_at timestamptz not null default now()
);

create index timeline_events_application_idx on public.timeline_events (application_id, occurred_at);

create table public.extensions_of_time (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications(id) on delete cascade,
    pp_reference text not null,
    prj_code_name text,
    requested_date date,
    agreed_date date not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index extensions_application_idx on public.extensions_of_time (application_id, agreed_date desc);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_updated_at_on_teams
before update on public.teams
for each row execute function public.set_updated_at();

create trigger set_updated_at_on_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_updated_at_on_applications
before update on public.applications
for each row execute function public.set_updated_at();

create trigger set_updated_at_on_issues
before update on public.issues
for each row execute function public.set_updated_at();

create trigger set_updated_at_on_extensions
before update on public.extensions_of_time
for each row execute function public.set_updated_at();

create function public.refresh_application_issue_stats()
returns trigger
language plpgsql
as $$
declare
    unresolved_count integer;
begin
    select count(*)
    into unresolved_count
    from public.issues
    where application_id = coalesce(new.application_id, old.application_id)
      and status not in ('Resolved', 'Closed');

    update public.applications
    set issues_count = coalesce(unresolved_count, 0),
        updated_at = now()
    where id = coalesce(new.application_id, old.application_id);

    return coalesce(new, old);
end;
$$;

create trigger issues_refresh_application_counter
after insert or update or delete on public.issues
for each row execute function public.refresh_application_issue_stats();

-- Default seed team to group internal users
insert into public.teams (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Planning Tracker', 'planning-tracker')
on conflict (id) do nothing;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (user_id, team_id, email, full_name)
    values (new.id, '00000000-0000-0000-0000-000000000001', coalesce(new.email, ''), new.raw_user_meta_data->>'full_name')
    on conflict (user_id) do update
        set email = excluded.email,
            full_name = excluded.full_name,
            updated_at = now();
    return new;
end;
$$;

create trigger create_profile_for_new_user
after insert on auth.users
for each row execute function public.handle_new_user();

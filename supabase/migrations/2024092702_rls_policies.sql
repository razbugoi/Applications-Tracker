-- Enable Row Level Security and define policies.

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.issues enable row level security;
alter table public.timeline_events enable row level security;
alter table public.extensions_of_time enable row level security;

-- Teams policies
create policy "team_read_members" on public.teams
    for select
    using (exists (
        select 1
        from public.profiles p
        where p.team_id = teams.id
          and p.user_id = auth.uid()
    ));

create policy "team_manage_service_role" on public.teams
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- Profiles policies
create policy "profile_read_self" on public.profiles
    for select
    using (user_id = auth.uid());

create policy "profile_upsert_self" on public.profiles
    for insert
    with check (user_id = auth.uid());

create policy "profile_update_self" on public.profiles
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "profile_manage_service_role" on public.profiles
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- Applications policies
create policy "applications_read_team" on public.applications
    for select
    using (exists (
        select 1 from public.profiles p
        where p.team_id = applications.team_id
          and p.user_id = auth.uid()
    ));

create policy "applications_write_team" on public.applications
    for insert
    with check (exists (
        select 1 from public.profiles p
        where p.team_id = applications.team_id
          and p.user_id = auth.uid()
    ));

create policy "applications_update_team" on public.applications
    for update
    using (exists (
        select 1 from public.profiles p
        where p.team_id = applications.team_id
          and p.user_id = auth.uid()
    ))
    with check (exists (
        select 1 from public.profiles p
        where p.team_id = applications.team_id
          and p.user_id = auth.uid()
    ));

create policy "applications_delete_service_role" on public.applications
    for delete
    using (auth.role() = 'service_role');

-- Issues policies
create policy "issues_read_team" on public.issues
    for select
    using (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = issues.application_id
          and p.user_id = auth.uid()
    ));

create policy "issues_write_team" on public.issues
    for insert
    with check (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = issues.application_id
          and p.user_id = auth.uid()
    ));

create policy "issues_update_team" on public.issues
    for update
    using (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = issues.application_id
          and p.user_id = auth.uid()
    ))
    with check (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = issues.application_id
          and p.user_id = auth.uid()
    ));

create policy "issues_delete_service_role" on public.issues
    for delete
    using (auth.role() = 'service_role');

-- Timeline events policies
create policy "timeline_read_team" on public.timeline_events
    for select
    using (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = timeline_events.application_id
          and p.user_id = auth.uid()
    ));

create policy "timeline_insert_team" on public.timeline_events
    for insert
    with check (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = timeline_events.application_id
          and p.user_id = auth.uid()
    ));

create policy "timeline_manage_service_role" on public.timeline_events
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- Extensions of time policies
create policy "extensions_read_team" on public.extensions_of_time
    for select
    using (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = extensions_of_time.application_id
          and p.user_id = auth.uid()
    ));

create policy "extensions_write_team" on public.extensions_of_time
    for insert
    with check (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = extensions_of_time.application_id
          and p.user_id = auth.uid()
    ));

create policy "extensions_update_team" on public.extensions_of_time
    for update
    using (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = extensions_of_time.application_id
          and p.user_id = auth.uid()
    ))
    with check (exists (
        select 1
        from public.applications a
        join public.profiles p on p.team_id = a.team_id
        where a.id = extensions_of_time.application_id
          and p.user_id = auth.uid()
    ));

create policy "extensions_delete_service_role" on public.extensions_of_time
    for delete
    using (auth.role() = 'service_role');

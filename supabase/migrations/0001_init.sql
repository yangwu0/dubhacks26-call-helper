-- Fresh schema. Tables and columns use snake_case (Postgres convention).
-- owners.id is the Supabase Auth user id (one id for both).
-- Wipe public and run this file after a reset.

create table owners (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  aliases text[] default '{}',
  phone text not null,
  timezone text default 'America/Los_Angeles',
  photon_number text
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references owners (id),
  conversation_id text unique,
  call_sid text,
  caller_number text,
  caller_name text,
  target_match boolean,
  classification text default 'unknown',
  risk_score int default 0,
  risk_reasons jsonb default '[]',
  action text default 'none',
  summary text,
  transcript jsonb,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table call_events (
  id bigint generated always as identity primary key,
  call_id uuid not null references calls (id) on delete cascade,
  type text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

create table flagged_numbers (
  owner_id uuid not null references owners (id) on delete cascade,
  number text not null,
  reason text,
  created_at timestamptz default now(),
  primary key (owner_id, number)
);

create table contacts (
  owner_id uuid not null references owners (id) on delete cascade,
  number text not null,
  name text,
  trusted boolean default true,
  primary key (owner_id, number)
);

alter publication supabase_realtime add table calls, call_events;

alter table owners enable row level security;
alter table calls enable row level security;
alter table call_events enable row level security;
alter table flagged_numbers enable row level security;
alter table contacts enable row level security;

grant usage on schema public to authenticated, service_role;
grant select on owners, calls, call_events, flagged_numbers, contacts
  to authenticated;
grant insert, update, delete on flagged_numbers, contacts to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Owner PII is written only by the service role (encrypted server-side).
revoke insert, update, delete, truncate on table owners from anon, authenticated;
revoke truncate on table
  calls,
  call_events,
  flagged_numbers,
  contacts
from anon, authenticated;

create policy owners_select_own on owners
  for select to authenticated
  using (id = auth.uid());

create policy calls_select_own on calls
  for select to authenticated
  using (owner_id = auth.uid());

create policy call_events_select_own on call_events
  for select to authenticated
  using (
    call_id in (
      select id from calls where owner_id = auth.uid()
    )
  );

create policy flagged_numbers_select_own on flagged_numbers
  for select to authenticated
  using (owner_id = auth.uid());

create policy flagged_numbers_insert_own on flagged_numbers
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy flagged_numbers_update_own on flagged_numbers
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy flagged_numbers_delete_own on flagged_numbers
  for delete to authenticated
  using (owner_id = auth.uid());

create policy contacts_select_own on contacts
  for select to authenticated
  using (owner_id = auth.uid());

create policy contacts_insert_own on contacts
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy contacts_update_own on contacts
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy contacts_delete_own on contacts
  for delete to authenticated
  using (owner_id = auth.uid());

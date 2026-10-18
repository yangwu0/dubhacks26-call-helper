-- Links each login to one owner row, then lets that signed-in user
-- read their own calls. The service role used by webhooks bypasses RLS.

alter table owners
  add column if not exists user_id uuid unique references auth.users (id) on delete cascade;

alter table owners enable row level security;
alter table calls enable row level security;
alter table call_events enable row level security;
alter table blocked_numbers enable row level security;
alter table contacts enable row level security;
alter table calendar_events enable row level security;
alter table messages enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on owners, blocked_numbers to authenticated;
grant select on calls, call_events to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

drop policy if exists "owners_select_own" on owners;
create policy "owners_select_own" on owners
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "owners_insert_own" on owners;
create policy "owners_insert_own" on owners
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "owners_update_own" on owners;
create policy "owners_update_own" on owners
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "calls_select_own" on calls;
create policy "calls_select_own" on calls
  for select to authenticated
  using (owner_id in (select id from owners where user_id = auth.uid()));

drop policy if exists "events_select_own" on call_events;
create policy "events_select_own" on call_events
  for select to authenticated
  using (
    call_id in (
      select calls.id
      from calls
      join owners on owners.id = calls.owner_id
      where owners.user_id = auth.uid()
    )
  );

drop policy if exists "blocked_authenticated" on blocked_numbers;
create policy "blocked_authenticated" on blocked_numbers
  for all to authenticated
  using (true)
  with check (true);

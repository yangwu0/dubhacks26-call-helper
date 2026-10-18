-- Each account keeps its own block list. A number blocked by one owner
-- is not blocked for anyone else.

alter table blocked_numbers
  add column if not exists owner_id uuid references owners (id) on delete cascade;

delete from blocked_numbers where owner_id is null;

alter table blocked_numbers
  alter column owner_id set not null;

alter table blocked_numbers drop constraint if exists blocked_numbers_pkey;
alter table blocked_numbers add primary key (owner_id, number);

drop policy if exists "blocked_authenticated" on blocked_numbers;
drop policy if exists "blocked_select_own" on blocked_numbers;
drop policy if exists "blocked_insert_own" on blocked_numbers;
drop policy if exists "blocked_update_own" on blocked_numbers;
drop policy if exists "blocked_delete_own" on blocked_numbers;

create policy "blocked_select_own" on blocked_numbers
  for select to authenticated
  using (owner_id in (select id from owners where user_id = auth.uid()));

create policy "blocked_insert_own" on blocked_numbers
  for insert to authenticated
  with check (owner_id in (select id from owners where user_id = auth.uid()));

create policy "blocked_update_own" on blocked_numbers
  for update to authenticated
  using (owner_id in (select id from owners where user_id = auth.uid()))
  with check (owner_id in (select id from owners where user_id = auth.uid()));

create policy "blocked_delete_own" on blocked_numbers
  for delete to authenticated
  using (owner_id in (select id from owners where user_id = auth.uid()));

-- A trusted contact belongs to one account. Knowing a number for one
-- person does not make that caller trusted for anyone else.

alter table contacts
  add column if not exists owner_id uuid references owners (id) on delete cascade;

delete from contacts where owner_id is null;

alter table contacts
  alter column owner_id set not null;

alter table contacts drop constraint if exists contacts_pkey;
alter table contacts add primary key (owner_id, number);

drop policy if exists "contacts_select_own" on contacts;
drop policy if exists "contacts_insert_own" on contacts;
drop policy if exists "contacts_update_own" on contacts;
drop policy if exists "contacts_delete_own" on contacts;

create policy "contacts_select_own" on contacts
  for select to authenticated
  using (owner_id in (select id from owners where user_id = auth.uid()));

create policy "contacts_insert_own" on contacts
  for insert to authenticated
  with check (owner_id in (select id from owners where user_id = auth.uid()));

create policy "contacts_update_own" on contacts
  for update to authenticated
  using (owner_id in (select id from owners where user_id = auth.uid()))
  with check (owner_id in (select id from owners where user_id = auth.uid()));

create policy "contacts_delete_own" on contacts
  for delete to authenticated
  using (owner_id in (select id from owners where user_id = auth.uid()));

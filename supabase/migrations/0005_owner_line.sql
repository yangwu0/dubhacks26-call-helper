-- Each account owns one Photon number. Calls arrive on that number only.
-- Authenticated users can edit their profile, not the assigned line.

alter table owners
  add column if not exists sift_number text,
  add column if not exists photon_resource_id text,
  add column if not exists photon_operation_id text,
  add column if not exists photon_line_error text;

create unique index if not exists owners_sift_number_unique
  on owners (sift_number)
  where sift_number is not null;

revoke update on table owners from authenticated;
grant update (name, aliases, phone, imessage_handle, timezone)
  on table owners to authenticated;

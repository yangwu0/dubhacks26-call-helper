-- Owner name, aliases, phone, and iMessage handle are encrypted by the
-- server before insert or update. Signed-in browsers may read a row, but
-- they cannot write it, so plaintext cannot be saved from the client.

revoke insert, update, delete, truncate on table owners from anon, authenticated;

revoke update (name, aliases, phone, imessage_handle, timezone)
  on table owners from anon, authenticated;

-- Truncate ignores row level security, so the public API roles cannot wipe data.
revoke truncate on table
  calls,
  call_events,
  blocked_numbers,
  contacts,
  calendar_events,
  messages
from anon, authenticated;

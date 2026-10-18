-- Dashboard Do not disturb toggle; read by ElevenLabs init as is_dnd_on.
alter table owners
  add column if not exists is_dnd_on boolean not null default false;

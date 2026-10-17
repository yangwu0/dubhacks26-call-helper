create table owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] default '{}',
  phone text not null,           -- E.164, the owner's real phone
  imessage_handle text,          -- phone or email used for iMessage
  timezone text default 'America/Los_Angeles'
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references owners(id),
  conversation_id text unique,   -- ElevenLabs conversation id
  call_sid text,                 -- Twilio call SID
  caller_number text,
  caller_name text,
  claimed_target text,
  target_match boolean,
  status text default 'in_progress',   -- in_progress | completed
  classification text default 'unknown', -- scam | legit_important | legit_routine | unknown
  risk_score int default 0,
  risk_reasons jsonb default '[]',
  caller_intent text,
  action text default 'none',    -- none | blocked | forwarded | message_taken | booked
  summary text,
  transcript jsonb,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table call_events (
  id bigint generated always as identity primary key,
  call_id uuid references calls(id) on delete cascade,
  type text not null,            -- transcript | risk | tool | action | system
  payload jsonb default '{}',
  created_at timestamptz default now()
);

create table blocked_numbers (number text primary key, reason text, created_at timestamptz default now());
create table contacts (number text primary key, name text, trusted boolean default true);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references owners(id),
  title text, starts_at timestamptz, ends_at timestamptz,
  source text default 'manual',  -- manual | sift
  status text default 'planned', -- planned | done | missed
  call_id uuid references calls(id)
);

create table messages (
  id bigint generated always as identity primary key,
  direction text,                -- out | in
  channel text,                  -- imessage | sms
  address text, body text,
  call_id uuid references calls(id),
  created_at timestamptz default now()
);

alter publication supabase_realtime add table calls, call_events;

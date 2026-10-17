# Sift: project spec (AGENTS.md)

This file is the shared contract for every AI agent working in this repo (Cursor, Claude Code, Gemini CLI, etc.). Read it fully before changing anything.

## Mission

Build **Sift**, an AI that answers your phone, in a hackathon (about 9 hours of coding). It must be demo-ready, not production-ready. Optimize for a flawless 2-minute recorded demo.

When an unknown number calls the owner's Twilio number:

1. An ElevenLabs voice agent answers. It always says it is an AI and that the call may be recorded.
2. It asks who the caller is trying to reach and why. A server tool fuzzy-matches the claimed name against the owner's name and aliases.
3. It scores scam risk (0 to 100) live, with reasons. The dashboard shows this in real time.
4. It routes the call:
   - **Scam** (score 75 or higher): stay calm, gather details for 1 to 3 turns, refuse everything, end the call, auto-block the number.
   - **Legit and important** (scheduling, medical, school, landlord, delivery) with the name matching and risk under 40: bridge the owner into a conference with the caller. The owner hears a whisper summary first. This is the 3-way call.
   - **Scheduling:** check availability, propose two slots, book the event.
   - **Legit but routine:** take a message.
5. After the call, Claude writes a summary. It is sent to the owner via iMessage (Photon) with a Twilio SMS fallback. The owner can reply with commands: `CALL`, `BLOCK`, `ADD`, `REPORT`.
6. A weekly progress report (calls handled, scams blocked, meetings booked, time saved) is generated on demand and sent as a message.

Stretch (only after everything above works):
- **Scan:** the owner forwards a suspicious email, text, or bill photo to the Sift number and gets a verdict and a plain-English explanation.
- **Bill decoder:** explain a medical bill or lease, flag likely errors, and list the owner's options.

## Stack (fixed; don't substitute)

- **App:** Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui. One repo, one deploy on Vercel. API routes serve all webhooks.
- **DB/realtime:** Supabase (Postgres + Realtime). Server uses the secret/service role key (`SUPABASE_SERVICE_ROLE_KEY`). The dashboard uses the publishable key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, value starts with `sb_publishable_`) plus Realtime. The env variable names stay the same even though Supabase renamed the keys.
- **Voice agent:** ElevenLabs Agents (conversational AI) with a Twilio phone number imported via the native integration. Agent tools are server webhooks. A conversation-initiation webhook returns dynamic variables.
- **Voice/telephony:** behind a `VoiceProvider` interface (`lib/voice.ts`), selected by env `VOICE_PROVIDER=photon|twilio`. `twilio` is the default and the fallback: a Twilio number imported into ElevenLabs. `photon` is the target for the Photon track: a Photon Spectrum voice line (SIP) routed to the ElevenLabs agent. See "Photon-first architecture" below.
- **LLM for summaries and scan:** Anthropic API (`@anthropic-ai/sdk`). Read the model name from env `ANTHROPIC_MODEL`.
- **Messaging (Photon is the primary UI):** Photon Spectrum (`spectrum-ts`) for iMessage. Free tier on a shared line. Credentials: `PHOTON_PROJECT_ID` and `PHOTON_PROJECT_SECRET` from app.photon.codes. Twilio SMS remains as a fallback implementation of `MessagingProvider`.
- **Package manager:** pnpm. Node 20.

Before using any third-party API, **read its current docs** rather than relying on memory:
- ElevenLabs: fetch `https://elevenlabs.io/docs/llms.txt` and read the pages on Agents tools, dynamic variables, Twilio native integration, Twilio personalization, and post-call webhooks.
- Twilio: Calls update, Conference TwiML, and the Node SDK.
- Photon: https://photon.codes/docs/spectrum-ts/introduction and https://github.com/photon-hq/spectrum-ts. Do NOT guess Photon APIs. If something is unclear (especially voice/SIP), build the interface and the fallback first and leave a clearly marked `TODO(photon)`.


## Photon-first architecture (we are competing for the Photon track)

Judges reward visible, meaningful use of Photon. Make Photon central to the experience, not a bolt-on:

1. **The owner's main interface is an iMessage thread with Sift** (Spectrum). Summaries, risk alerts, and commands (`CALL`, `BLOCK`, `UNBLOCK`, `ADD`, `UNDO`, `REPORT`) all live there. Use iMessage-native features where Spectrum supports them (reactions, polls for "Block / Allow", voice notes, attachments).
2. **Voice through Photon.** Photon exposes SIP voice calls on its iMessage lines and says the same number can be messaged and called. Target design: the Photon voice line receives the call and routes it by SIP to the ElevenLabs agent (ElevenLabs supports SIP trunking; verify the exact trunk settings in its docs). The same number then continues the conversation in iMessage after the call.
3. **Cross-channel moment for the demo:** during a scam call, the owner receives an iMessage in real time ("Possible IRS scam, 82%. Reply BLOCK"), and replying `BLOCK` ends the call and blocks the number. The owner can also text `CALL` to be bridged into a live call.
4. **Access status is UNKNOWN.** We may not have Photon voice credentials at first (dedicated voice lines are paid). Therefore:
   - Everything must work end to end with `VOICE_PROVIDER=twilio` and `MESSAGING_PROVIDER=photon` (or `sms`) first.
   - Photon voice is a drop-in implementation of `VoiceProvider` once credentials exist. Implement the interface so switching is one env var.
   - Never block other work waiting on Photon voice.

`VoiceProvider` interface (define in `lib/voice.ts`): `forwardCall({callId, ownerPhone, whisperText})`, `endCall({callId})`, `callOwner({reason})`, `normalizeInboundCall(req)`. The Twilio implementation is `lib/voice-twilio.ts`. The Photon implementation is `lib/voice-photon.ts`.

## Hard rules

- Cursor: make small, reviewable diffs. Run `pnpm build` (and `pnpm lint` if configured) before declaring a task done. Never leave the build broken on `main`.
- Ship vertical slices. A working ugly end-to-end flow beats a polished half.
- Do not over-engineer. No auth system, no multi-tenant, no queues. A single hardcoded owner row is fine.
- All webhook and tool endpoints verify the header `x-sift-secret === process.env.SIFT_WEBHOOK_SECRET`. The post-call webhook also verifies the ElevenLabs signature if feasible.
- Never commit secrets. Keep `.env.example` current.
- TypeScript types for the tool contracts live in `lib/contracts.ts`. Don't change them without telling the other workspaces (note it in `docs/CHANGELOG.md`).
- Only touch files in your workspace's ownership list (listed in your workspace prompt). If you need a change elsewhere, write it in `docs/REQUESTS.md` and continue.
- Commit small and often. Commit message format: `ws1: forward-call tool`.
- Every endpoint must respond in under 2 seconds. Anything slower must be async, because the caller is on a live phone call.
- Safety and ethics are part of the product. The agent always discloses it is an AI. It announces recording. It never reveals the owner's private details (address, full schedule, financial info). It only shares free or busy availability. It never claims to be human.

## Data model (Supabase; one migration `supabase/migrations/0001_init.sql`)

```sql
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
```

## Tool contracts (ElevenLabs → our server)

All are `POST /api/tools/<name>`, JSON body, header `x-sift-secret`. Every body includes `conversation_id` (ElevenLabs system variable `system__conversation_id`). Responses are small JSON.

| Tool | Body | Response |
|---|---|---|
| `verify_caller_target` | `{conversation_id, claimed_target}` | `{match: boolean, confidence: number}` (fuzzy match vs owner name and aliases; update `calls.target_match`) |
| `report_risk` | `{conversation_id, score, reasons: string[], caller_intent, caller_name?}` | `{ok, recommended_action: "continue"|"end_as_scam"|"may_forward"}` (server applies its own rules too: blocked number or score 75 or higher → `end_as_scam`) |
| `check_availability` | `{conversation_id, date_from, date_to}` | `{free_slots: {start,end}[]}` (only free windows, never event details) |
| `book_event` | `{conversation_id, title, starts_at, ends_at, caller_name}` | `{ok, event_id}` |
| `forward_call` | `{conversation_id, reason, urgency}` | `{ok, message}`. The server REFUSES if `target_match` is false or `risk_score >= 40`. |
| `take_message` | `{conversation_id, caller_name, callback_number, message}` | `{ok}` |

Other endpoints:
- `POST /api/elevenlabs/init`: Twilio personalization webhook. Receives `caller_id`, `agent_id`, `called_number`, `call_sid`. Creates the `calls` row and returns `conversation_initiation_client_data` with dynamic variables: `owner_name`, `caller_number`, `is_blocked`, `is_known_contact`, `call_sid`.
- `POST /api/elevenlabs/post-call`: receives the transcript. Claude summarizes it, `calls` is updated, the number is auto-blocked if it was a scam, and the owner is messaged.
- `POST /api/photon/inbound`: the owner's iMessage replies (commands). Also supports SMS via a Twilio webhook if the fallback is active.
- `POST /api/report/weekly`: generates and sends the weekly report. `GET` returns JSON for the dashboard.
- `POST /api/scan` (stretch).

## Forward / 3-way call implementation

1. Create the conference name `sift-${callSid}`.
2. Update the **live caller leg** with Twilio: `calls(callSid).update({ twiml })` where twiml says "Connecting you now" and then `<Dial><Conference>sift-...</Conference></Dial>`. Note: this ends the ElevenLabs media stream, which is acceptable.
3. Simultaneously create an outbound call to `owner.phone` from the Sift number with TwiML that **whispers** the summary ("Call from {name} about {reason}. Connecting you now.") and then joins the same conference (`endConferenceOnExit=true`).
4. If the owner doesn't answer within about 20 seconds, fall back to taking a message and send the owner a text.
5. Write a `call_events` row for each step.

## Dashboard (the demo's visual)

Dark, clean, sieve-themed branding ("Sift": noise goes in, only the real calls come through). Pages:
- `/` **Live**: big animated risk meter, live transcript, current action badge, last 5 calls. Uses Supabase Realtime.
- `/calls`, `/calls/[id]`: call log and detail (transcript, risk reasons timeline, summary).
- `/report`: weekly report with stat tiles and the Claude-written paragraph.
- `/settings`: owner name, aliases, phone, blocked numbers.
- **Demo mode toggle:** a "Simulate scam call" button that replays a scripted sequence of `call_events` and risk updates. This is our fallback if live calls fail during recording.

## Definition of done (priority order)

1. A real phone call to the Twilio number is answered by the agent. ✔ must work
2. Name check and live risk score appear on the dashboard. ✔ must work
3. Scam path: ends the call, blocks the number, sends the summary. ✔ must work
4. Legit-important path: owner's phone rings, conference bridges. ✔ must work
5. iMessage summary and reply commands. ✔ must work
6. Scheduling: free slots and booked event. ○ should work
7. Weekly report. ○ should work
8. Scan / bill decoder. ○ stretch
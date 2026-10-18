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
   - **Legit but routine:** take a message.
5. After the call, Claude writes a summary. It is stored on the call for the dashboard. (iMessage/SMS alerts and reply commands are disabled for now.)
6. A weekly progress report (calls handled, scams blocked, time saved) is generated on demand for the dashboard.

Stretch (only after everything above works):
- **Scan:** the owner forwards a suspicious email, text, or bill photo to the Sift number and gets a verdict and a plain-English explanation.
- **Bill decoder:** explain a medical bill or lease, flag likely errors, and list the owner's options.

## Stack (fixed; don't substitute)

- **App:** Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui. One repo, one deploy on Vercel. API routes serve all webhooks.
- **DB/realtime:** Supabase (Postgres + Realtime). Server uses the secret/service role key (`SUPABASE_SERVICE_ROLE_KEY`). The dashboard uses the publishable key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, value starts with `sb_publishable_`) plus Realtime. The env variable names stay the same even though Supabase renamed the keys.
- **Voice agent:** ElevenLabs Agents (conversational AI) with a Twilio phone number imported via the native integration. Agent tools are server webhooks. A conversation-initiation webhook returns dynamic variables.
- **Voice/telephony:** behind a `VoiceProvider` interface (`lib/voice.ts`), selected by env `VOICE_PROVIDER=photon|twilio`. `twilio` is the default and the fallback: a Twilio number imported into ElevenLabs. `photon` is the target for the Photon track: a Photon Spectrum voice line (SIP) routed to the ElevenLabs agent. See "Photon-first architecture" below.
- **LLM for summaries and scan:** Anthropic API (`@anthropic-ai/sdk`). Read the model name from env `ANTHROPIC_MODEL`.
- **Messaging:** disabled for now (no iMessage/SMS send or inbound commands). Photon credentials are for voice/SIP and number lookup only (`PHOTON_PROJECT_ID`, `PHOTON_API_KEY`).
- **Package manager:** pnpm. Node 20.

Before using any third-party API, **read its current docs** rather than relying on memory:
- ElevenLabs: fetch `https://elevenlabs.io/docs/llms.txt` and read the pages on Agents tools, dynamic variables, Twilio native integration, Twilio personalization, and post-call webhooks.
- Twilio: Calls update, Conference TwiML, and the Node SDK.
- Photon: https://photon.codes/docs/spectrum-ts/introduction and https://github.com/photon-hq/spectrum-ts. Do NOT guess Photon APIs. If something is unclear (especially voice/SIP), build the interface and the fallback first and leave a clearly marked `TODO(photon)`.


## Photon voice (track)

Photon is the telephony front door. A Photon SMS/voice number receives the call and routes by SIP to the ElevenLabs agent. Summaries and controls live on the dashboard until messaging is re-enabled.

`VoiceProvider` interface (define in `lib/voice.ts`): `forwardCall({callId, ownerPhone, whisperText})`, `endCall({callId})`, `callOwner({reason})`, `normalizeInboundCall(req)`. Implementation: `lib/voice-photon.ts` (`VOICE_PROVIDER=photon`).

## Hard rules

- Cursor: make small, reviewable diffs. Run `pnpm build` (and `pnpm lint` if configured) before declaring a task done. Never leave the build broken on `main`.
- Ship vertical slices. A working ugly end-to-end flow beats a polished half.
- Do not over-engineer. No auth system, no multi-tenant, no queues. A single hardcoded owner row is fine.
- All webhook and tool endpoints verify the header `x-sift-secret === process.env.SIFT_WEBHOOK_SECRET`. The post-call webhook also verifies the ElevenLabs signature if feasible.
- Never commit secrets. Keep `.env.example` current.
- TypeScript types for the tool contracts live in `lib/contracts.ts`. Don't change them without coordinating with other workspaces.
- Only touch files in your workspace's ownership list (listed in your workspace prompt).
- Commit small and often. Commit message format: `ws1: forward-call tool`.
- Every endpoint must respond in under 2 seconds. Anything slower must be async, because the caller is on a live phone call.
- Safety and ethics are part of the product. The agent always discloses it is an AI. It announces recording. It never reveals the owner's private details (address, schedule, financial info). It never claims to be human.

## Data model (Supabase; one migration `supabase/migrations/0001_init.sql`)

Postgres convention: **snake_case** plural tables, snake_case columns. See `supabase/migrations/0001_init.sql` for the full DDL.

| Table | Purpose |
|-------|---------|
| `owners` | Profile; `id` is the Auth user id; PII encrypted server-side |
| `calls` | One row per conversation (`conversation_id`, risk, summary, …) |
| `call_events` | Timeline for a call (Realtime) |
| `flagged_numbers` | Per-owner flag list `(owner_id, number)` |
| `contacts` | Per-owner trusted numbers |

Realtime publication: `calls`, `call_events`.

## Tool contracts (ElevenLabs → our server)

All are `POST /api/tools/<name>`, JSON body, header `x-sift-secret`. Every body includes `conversation_id` (ElevenLabs system variable `system__conversation_id`). Responses are small JSON.

| Tool | Body | Response |
|---|---|---|
| `verify_caller_target` | `{conversation_id, claimed_target}` | `{match: boolean, confidence: number}` (fuzzy match vs owner name and aliases; update `calls.target_match`) |
| `report_risk` | `{conversation_id, score, reasons: string[], caller_intent, caller_name?}` | `{ok, recommended_action: "continue"|"end_as_scam"|"may_forward"}` (server applies its own rules too: blocked number or score 75 or higher → `end_as_scam`) |
| `forward_call` | `{conversation_id, reason, urgency}` | `{ok, message}`. The server REFUSES if `target_match` is false or `risk_score >= 40`. |
| `take_message` | `{conversation_id, caller_name, callback_number, message}` | `{ok}` |

Other endpoints:
<<<<<<< Updated upstream
- `POST /api/elevenlabs/init`: Twilio personalization webhook. Receives `caller_id`, `agent_id`, `called_number`, `call_sid`. Creates the `calls` row and returns `conversation_initiation_client_data` with dynamic variables: `owner_name`, `caller_number`, `is_blocked`, `is_known_contact`, `call_sid`, `temp_flag` (temporary always `true` for agent testing).
=======
- `POST /api/elevenlabs/init`: Twilio personalization webhook. Receives `caller_id`, `agent_id`, `called_number`, `call_sid`. Creates the `calls` row and returns `conversation_initiation_client_data` with dynamic variables: `user_name`, `caller_number`, `is_blocked`, `is_known_contact`, `call_sid`, `is_dnd_on` (from `owners.is_dnd_on`; true when dashboard Do not disturb is on).
>>>>>>> Stashed changes
- `POST /api/elevenlabs/post-call`: receives the transcript. Claude summarizes it, `calls` is updated, the number is auto-blocked if it was a scam, and the owner is messaged.
- `POST /api/report/weekly`: generates the weekly report JSON (same as `GET`; no message send).
- `POST /api/scan` (stretch).

## Forward / 3-way call implementation

1. Create the conference name `sift-${callSid}`.
2. Update the **live caller leg** with Twilio: `calls(callSid).update({ twiml })` where twiml says "Connecting you now" and then `<Dial><Conference>sift-...</Conference></Dial>`. Note: this ends the ElevenLabs media stream, which is acceptable.
3. Simultaneously create an outbound call to `owner.phone` from the Sift number with TwiML that **whispers** the summary ("Call from {name} about {reason}. Connecting you now.") and then joins the same conference (`endConferenceOnExit=true`).
4. If the owner doesn't answer within about 20 seconds, fall back to taking a message and send the owner a text.
5. Write a `call_events` row for each step.

## Dashboard (the demo's visual)

**Phone-first.** Design for ~390px screens first; desktop is enhancement. Prefer stacked lists over tables, thumb-reachable actions, and the existing bottom nav on small viewports.

Dark, clean, sieve-themed branding ("Sift": noise goes in, only the real calls come through). Pages:
- `/` **Live**: big animated risk meter, live transcript, current action badge, last 5 calls. Uses Supabase Realtime.
- `/calls`, `/calls/[id]`: call log and detail (transcript, risk reasons timeline, summary).
- `/report`: weekly report with stat tiles and the Claude-written paragraph.
- `/settings`: owner name, aliases, phone, flagged numbers.
- **Demo mode toggle:** a "Simulate scam call" button that replays a scripted sequence of `call_events` and risk updates. This is our fallback if live calls fail during recording.

## Definition of done (priority order)

1. A real phone call to the Twilio number is answered by the agent. ✔ must work
2. Name check and live risk score appear on the dashboard. ✔ must work
3. Scam path: ends the call, blocks the number, sends the summary. ✔ must work
4. Legit-important path: owner's phone rings, conference bridges. ✔ must work
5. iMessage summary and reply commands. ○ deferred (messaging removed for now)
6. Weekly report (dashboard JSON). ○ should work
7. Scan / bill decoder. ○ stretch

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

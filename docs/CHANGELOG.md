# Changelog

## 2026-10-18

- Removed `evals/` (scam scripts + `run.ts`) and `scripts/call-test.ts`.
- **Messaging removed** for now: no iMessage/SMS send, no `/api/photon/inbound`, no reply commands (`CALL`/`BLOCK`/…). Photon is voice/SIP only. Post-call and `take_message` still write to `calls`; weekly report returns JSON only. Deleted `lib/messaging.ts`, `lib/photon.ts`, `scripts/test-messaging.ts`. `formatPostCallMessage` lives in `lib/anthropic.ts`. Dropped `MESSAGING_PROVIDER` / `PHOTON_WEBHOOK_SECRET` from `.env.example` and `spectrum-ts` dependency.

## 2026-10-17

- `owners.user_id` links a Supabase Auth user to their profile. Dashboard reads and settings writes go through that user's session. Tool contracts are unchanged.
- **Twilio removed** from runtime: photon-only voice (`lib/voice.ts`, `lib/forward.ts`) and messaging (`lib/messaging.ts`). Deleted `lib/twilio.ts`, `lib/voice-twilio.ts`, and `/api/twilio/owner-status`.
- **Transcripts:** post-call sets `calls.transcript` to null. Scams get a Claude summary (texted to owner). Legit/message calls store message text in `summary`; `take_message` texts the owner during the call.
- ws1: Photon is the voice provider. `forward_call` returns optional `transfer_number` for SIP conference transfer. `call_sid` on init is optional; SIP may send `call_id`.
- `book_event` returns `{ ok: false, event_id: "" }` when the slot is outside weekday 9:00–18:00 owner-local time or overlaps an existing event.
- Post-call auth: ElevenLabs `elevenlabs-signature` HMAC (`ELEVENLABS_WEBHOOK_SECRET`). Optional `x-sift-secret` must match when present.
- ws3: `summarize(transcript)` returns the owner-facing post-call string; `summarize(transcript, callMeta)` returns structured JSON.
- ws3: `POST /api/scan`, weekly report routes, Photon inbound via spectrum-ts.
- ws0: scaffold, contracts, stub routes.

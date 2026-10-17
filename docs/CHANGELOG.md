# Changelog

## 2026-10-17

- ws1: Photon is the voice provider. `forward_call` returns optional `transfer_number` so the ElevenLabs agent can conference-transfer the live SIP call. `call_sid` on the initiation webhook is optional; SIP may send `call_id` instead. Twilio conference bridging remains only when `VOICE_PROVIDER=twilio`.
- `book_event` returns `{ ok: false, event_id: "" }` when the slot is outside weekday 9:00–18:00 owner-local time or overlaps an existing event. `event_id` was already a required string.
- Post-call authentication is the ElevenLabs `elevenlabs-signature` HMAC (`ELEVENLABS_WEBHOOK_SECRET`). A present `x-sift-secret` header must still match. The header is optional because the post-call docs authenticate with the signature.
- `summarize()` is still the WS3 stub. Post-call calls it and, if it throws, stores a one-line fallback so the owner still gets a text.
- Photon voice remains `TODO(photon)` until a Spectrum voice line exists.

- ws0: scaffolded the Next.js app, shared clients, tool contracts, and 501 stub routes.
- `lib/contracts.ts` includes the six agent tools plus the ElevenLabs init and post-call webhook shapes from the current docs. The init request includes `conversation_id`, which ElevenLabs sends and AGENTS.md does not list.
- Photon inbound has no zod schema. The Spectrum webhook body was not verified.

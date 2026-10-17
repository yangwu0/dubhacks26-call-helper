# Changelog

## 2026-10-17

- ws1: Photon is the voice provider. `forward_call` returns optional `transfer_number` so the ElevenLabs agent can conference-transfer the live SIP call. `call_sid` on the initiation webhook is optional; SIP may send `call_id` instead. Twilio conference bridging remains only when `VOICE_PROVIDER=twilio`.
- `book_event` returns `{ ok: false, event_id: "" }` when the slot is outside weekday 9:00–18:00 owner-local time or overlaps an existing event. `event_id` was already a required string.
- Post-call authentication is the ElevenLabs `elevenlabs-signature` HMAC (`ELEVENLABS_WEBHOOK_SECRET`). A present `x-sift-secret` header must still match. The header is optional because the post-call docs authenticate with the signature.
- ws3: `summarize(transcript, callMeta)` returns zod-checked JSON (`classification`, `risk_score`, `scam_type`, `summary`, `key_details`, `suggested_action`). A missing transcript says so and does not invent a call. `summarize(transcript)` still returns a string, now the owner-facing post-call message, so the existing post-call route typechecks.
- ws3: iMessage send/receive uses Stable spectrum-ts. `POST /api/photon/inbound` verifies Spectrum's HMAC via `app.webhook()`. A JSON body with `x-sift-secret` can run the same commands without Photon. Live scam alerts (`sendLiveRiskAlert`) still need `report_risk` to call them.
- Photon voice remains `TODO(photon)` until a Spectrum voice line exists.

- ws0: scaffolded the Next.js app, shared clients, tool contracts, and 501 stub routes.
- `lib/contracts.ts` includes the six agent tools plus the ElevenLabs init and post-call webhook shapes from the current docs. The init request includes `conversation_id`, which ElevenLabs sends and AGENTS.md does not list.
- Photon inbound has no zod schema. The Spectrum webhook body was not verified.

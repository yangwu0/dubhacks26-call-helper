# Changelog

## 2026-10-17

- ws0: scaffolded the Next.js app, shared clients, tool contracts, and 501 stub routes.
- `lib/contracts.ts` includes the six agent tools plus the ElevenLabs init and post-call webhook shapes from the current docs. The init request includes `conversation_id`, which ElevenLabs sends and AGENTS.md does not list.
- Photon inbound has no zod schema. The Spectrum webhook body was not verified.

# Requests

## Open

- WS1: paste the fenced text block in `docs/risk-rubric.md` into the ElevenLabs agent system prompt, in the `report_risk` section. Do not paraphrase it.

## Done

- Messaging (iMessage/SMS alerts, inbound commands, spectrum-ts) removed; Photon is voice-only for now. Summaries stay on the dashboard.
- WS3: `summarize(transcript, callMeta)` returns zod-validated JSON. One argument still returns the formatted string so post-call keeps typechecking. `formatPostCallMessage` is in `lib/anthropic.ts`.
- WS1: Photon voice uses the ElevenLabs SIP trunk. `callOwner` places an outbound call with `conversationalAi.sipTrunk.outboundCall`. Live forwarding returns `transfer_number` for the agent's `transfer_to_number` tool.

# Requests

## Open

- WS1: paste the fenced text block in `docs/risk-rubric.md` into the ElevenLabs agent system prompt, in the `report_risk` section. Do not paraphrase it. `evals/run.ts` scores caller turns with that same text. The accuracy run is blocked until `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are set.
- Whoever owns `app/api/tools/report_risk/route.ts`: during a call, when `recommended_action` is `end_as_scam` (or the score crosses 75), call `sendLiveRiskAlert` from `lib/messaging.ts`. It texts the owner and sends a Block/Allow poll. WS3 cannot edit that route. Pass `to` as `owner.imessage_handle || owner.phone`, plus `callerLabel`, `callerNumber`, `score`, and a short `reason`.
- Post-call already calls `summarize(transcript)` and gets the owner-facing string. To store the structured fields, call `summarize(transcript, callMeta)` and `formatPostCallMessage` from `lib/messaging.ts`.

## Done

- WS3: `PhotonMessaging.send` uses spectrum-ts (`imessage.user` + `space.create` + `space.send`). Inbound iMessage is `app.webhook()` on `POST /api/photon/inbound`.
- WS3: `summarize(transcript, callMeta)` returns zod-validated JSON. One argument still returns the formatted string so post-call keeps typechecking.
- WS1: Photon voice uses the ElevenLabs SIP trunk. `callOwner` places an outbound call with `conversationalAi.sipTrunk.outboundCall`. Live forwarding returns `transfer_number` for the agent's `transfer_to_number` tool. Spectrum has no conference API.

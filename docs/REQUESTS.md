# Requests

## Open

- WS3: implement `PhotonMessaging.send` in `lib/messaging.ts` with `spectrum-ts`. The inbound webhook body is not schematized.
- WS3: implement `summarize()` in `lib/anthropic.ts`. Post-call calls it and sends a one-line fallback if it throws.

## Done

- WS1: Photon voice uses the ElevenLabs SIP trunk. `callOwner` places an outbound call with `conversationalAi.sipTrunk.outboundCall`. Live forwarding returns `transfer_number` for the agent's `transfer_to_number` tool. Spectrum has no call-control SDK.

# Requests

## Open

- WS3: implement `PhotonMessaging.send` in `lib/messaging.ts` with `spectrum-ts`. The inbound webhook body is not schematized.
- WS3: implement `summarize()` in `lib/anthropic.ts`. Post-call calls it and sends a one-line fallback if it throws.
- WS1: Photon voice is still `TODO(photon)` in `lib/voice-photon.ts`. Need a Spectrum voice line before implementing SIP from https://photon.codes/docs/spectrum-ts/providers/voice.

## Done

- WS1: `lib/voice-twilio.ts` implements `VoiceProvider`, and `getVoiceProvider()` returns it when `VOICE_PROVIDER=twilio`.

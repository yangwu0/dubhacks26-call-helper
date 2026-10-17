import type { VoiceProvider } from "@/lib/voice";

// TODO(photon): no Photon voice credentials are configured.
// Implement this from the Stable Spectrum voice docs once a voice line exists:
// https://photon.codes/docs/spectrum-ts/providers/voice
// https://photon.codes/docs/spectrum-ts/providers/voice/inbound-calls
// https://photon.codes/docs/spectrum-ts/providers/voice/outbound-calls
// Target: the Photon iMessage line receives the call and SIP-routes it to the
// ElevenLabs agent. Do not invent SDK method names before that implementation.
export const photonVoice: VoiceProvider = {
  async forwardCall(input) {
    throw new Error(
      `TODO(photon): forwardCall ${input.callId} to ${input.ownerPhone}`,
    );
  },
  async endCall(input) {
    throw new Error(`TODO(photon): endCall ${input.callId}`);
  },
  async callOwner(input) {
    throw new Error(`TODO(photon): callOwner (${input.reason})`);
  },
  async normalizeInboundCall() {
    throw new Error("TODO(photon): normalizeInboundCall");
  },
};

import type { VoiceProvider } from "./voice";

// TODO(photon): SIP voice once Photon voice credentials exist.
// Docs: https://photon.codes/docs/spectrum-ts/introduction
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

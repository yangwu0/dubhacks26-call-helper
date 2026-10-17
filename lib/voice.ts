import { photonVoice } from "./voice-photon";
import { twilioVoice } from "./voice-twilio";

export type ForwardCallInput = {
  callId: string;
  ownerPhone: string;
  whisperText: string;
};

export type EndCallInput = {
  callId: string;
};

export type CallOwnerInput = {
  reason: string;
};

export type NormalizedInboundCall = {
  callId: string;
  from: string;
  to: string;
};

export interface VoiceProvider {
  forwardCall(input: ForwardCallInput): Promise<void>;
  endCall(input: EndCallInput): Promise<void>;
  callOwner(input: CallOwnerInput): Promise<void>;
  normalizeInboundCall(req: Request): Promise<NormalizedInboundCall>;
}

export function getVoiceProvider(): VoiceProvider {
  const provider = process.env.VOICE_PROVIDER ?? "photon";
  if (provider === "photon") return photonVoice;
  if (provider === "twilio") return twilioVoice;
  throw new Error(
    `Unknown VOICE_PROVIDER "${provider}". Expected twilio or photon.`,
  );
}

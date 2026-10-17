import { photonVoice } from "./voice-photon";

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
  const provider = process.env.VOICE_PROVIDER ?? "twilio";
  if (provider === "photon") return photonVoice;
  if (provider === "twilio") {
    // lib/voice-twilio.ts is owned by WS1 and is not created here.
    throw new Error(
      "TODO(ws1): wire lib/voice-twilio.ts into getVoiceProvider().",
    );
  }
  throw new Error(
    `Unknown VOICE_PROVIDER "${provider}". Expected twilio or photon.`,
  );
}

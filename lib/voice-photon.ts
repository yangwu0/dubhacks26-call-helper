import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type {
  CallOwnerInput,
  EndCallInput,
  ForwardCallInput,
  NormalizedInboundCall,
  VoiceProvider,
} from "@/lib/voice";

const RING_SECONDS = 20;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// Stable Spectrum voice docs: there is no spectrum-ts call-control method yet.
// A Photon iMessage line delivers inbound calls to ElevenLabs over SIP, and
// ElevenLabs places outbound calls back through that same Photon SIP trunk.
// https://photon.codes/docs/spectrum-ts/providers/voice
// https://photon.codes/docs/beta/cookbooks/voice/elevenlabs
export const photonVoice: VoiceProvider = {
  async forwardCall(input: ForwardCallInput) {
    if (!input.ownerPhone.startsWith("+")) {
      throw new Error("Owner phone must be E.164, including the leading +");
    }
    // The caller is already connected to the ElevenLabs agent. The agent
    // completes the handoff with transfer_to_number. This method only checks
    // that the destination is dialable.
    void input.callId;
    void input.whisperText;
  },
  async endCall(input: EndCallInput) {
    throw new Error(
      `End the live Photon call ${input.callId} with the ElevenLabs end-call tool. Spectrum has no server API for hanging up a SIP call.`,
    );
  },
  async callOwner(input: CallOwnerInput) {
    const toNumber = input.toNumber.trim();
    if (!toNumber.startsWith("+")) {
      throw new Error("Owner phone must be E.164, including the leading +");
    }
    const client = new ElevenLabsClient({
      apiKey: required("ELEVENLABS_API_KEY"),
    });
    await client.conversationalAi.sipTrunk.outboundCall({
      agentId: required("ELEVENLABS_AGENT_ID"),
      agentPhoneNumberId: required("ELEVENLABS_PHONE_NUMBER_ID"),
      toNumber,
      telephonyCallConfig: { ringingTimeoutSecs: RING_SECONDS },
      conversationInitiationClientData: {
        conversationConfigOverride: {
          agent: { firstMessage: input.reason },
        },
      },
    });
  },
  async normalizeInboundCall(req: Request): Promise<NormalizedInboundCall> {
    const body = (await req.json()) as {
      call_sid?: string;
      call_id?: string;
      caller_id?: string;
      called_number?: string;
    };
    const callId = body.call_sid || body.call_id || "";
    if (!callId) throw new Error("Missing call_sid");
    return {
      callId,
      from: body.caller_id ?? "",
      to: body.called_number ?? "",
    };
  },
};

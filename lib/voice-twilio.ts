import twilio from "twilio";
import { getTwilioClient } from "@/lib/twilio";
import type {
  CallOwnerInput,
  EndCallInput,
  ForwardCallInput,
  NormalizedInboundCall,
  VoiceProvider,
} from "@/lib/voice";

const OWNER_RING_SECONDS = 20;

export function conferenceName(callSid: string): string {
  return `sift-${callSid}`;
}

export function callerConferenceTwiml(callSid: string): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say("Connecting you now.");
  response.dial().conference(conferenceName(callSid));
  return response.toString();
}

export function ownerWhisperTwiml(callSid: string, whisperText: string): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(whisperText);
  response.dial().conference(
    { endConferenceOnExit: true },
    conferenceName(callSid),
  );
  return response.toString();
}

export function missedOwnerTwiml(): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(
    "I couldn't reach them. I'll pass along your message.",
  );
  response.hangup();
  return response.toString();
}

export async function bridgeTwilioConference(input: {
  callSid: string;
  ownerPhone: string;
  whisperText: string;
  statusCallbackUrl: string;
}): Promise<{ ownerCallSid: string; conferenceName: string }> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER is required");
  const client = getTwilioClient();
  const name = conferenceName(input.callSid);
  const [ownerCall] = await Promise.all([
    client.calls.create({
      to: input.ownerPhone,
      from,
      twiml: ownerWhisperTwiml(input.callSid, input.whisperText),
      timeout: OWNER_RING_SECONDS,
      statusCallback: input.statusCallbackUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["answered", "completed"],
    }),
    client.calls(input.callSid).update({
      twiml: callerConferenceTwiml(input.callSid),
    }),
  ]);
  return { ownerCallSid: ownerCall.sid, conferenceName: name };
}

export const twilioVoice: VoiceProvider = {
  async forwardCall(input: ForwardCallInput) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await bridgeTwilioConference({
      callSid: input.callId,
      ownerPhone: input.ownerPhone,
      whisperText: input.whisperText,
      statusCallbackUrl: `${base.replace(/\/$/, "")}/api/twilio/owner-status?call_sid=${encodeURIComponent(input.callId)}`,
    });
  },
  async endCall(input: EndCallInput) {
    await getTwilioClient().calls(input.callId).update({ status: "completed" });
  },
  async callOwner(input: CallOwnerInput) {
    const from = process.env.TWILIO_PHONE_NUMBER;
    const to = process.env.OWNER_PHONE;
    if (!from || !to) {
      throw new Error("TWILIO_PHONE_NUMBER and OWNER_PHONE are required");
    }
    const response = new twilio.twiml.VoiceResponse();
    response.say(input.reason);
    await getTwilioClient().calls.create({
      to,
      from,
      twiml: response.toString(),
      timeout: OWNER_RING_SECONDS,
    });
  },
  async normalizeInboundCall(req: Request): Promise<NormalizedInboundCall> {
    const form = await req.formData();
    const callId = String(form.get("CallSid") ?? "");
    const from = String(form.get("From") ?? "");
    const to = String(form.get("To") ?? "");
    if (!callId) throw new Error("Missing CallSid");
    return { callId, from, to };
  },
};

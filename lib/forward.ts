import { photonVoice } from "@/lib/voice-photon";
import {
import { getMessagingProvider } from "@/lib/messaging";
import { getTwilioClient } from "@/lib/twilio";
import { photonVoice } from "@/lib/voice-photon";
import {
  bridgeTwilioConference,
  missedOwnerTwiml,
} from "@/lib/voice-twilio";
import {
  getCallBySid,
  getOwner,
  insertEvent,
  serviceClient,
  type CallRow,
} from "@/app/api/tools/db";
import type { SupabaseClient } from "@supabase/supabase-js";

const NO_ANSWER_WAIT_MS = 25_000;
const NO_ANSWER_STATUSES = new Set([
  "no-answer",
  "busy",
  "failed",
  "canceled",
  "queued",
  "ringing",
]);

export type ForwardResult = {
  ownerCallSid: string;
  conferenceName: string;
  parentCallSid: string;
  transferNumber?: string;
};

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function whisperText(input: {
  callerName: string | null;
  callerNumber: string | null;
  reason: string;
  urgency: string;
}): string {
  const who = input.callerName || input.callerNumber || "an unknown caller";
  const urgency = input.urgency.trim();
  const extra = urgency ? ` Urgency: ${urgency}.` : "";
  return `Call from ${who} about ${input.reason}.${extra} Connecting you now.`;
}

export async function startForward(input: {
  call: CallRow;
  ownerPhone: string;
  reason: string;
  urgency: string;
}): Promise<ForwardResult> {
  const text = whisperText({
    callerName: input.call.caller_name,
    callerNumber: input.call.caller_number,
    reason: input.reason,
    urgency: input.urgency,
  });
  const supabase = serviceClient();
  await insertEvent(supabase, input.call.id, "action", {
    step: "dialing_owner",
    reason: input.reason,
    urgency: input.urgency,
    whisper: text,
    owner_phone: input.ownerPhone,
  });

  await photonVoice.forwardCall({
    callId: input.call.call_sid || input.call.conversation_id || input.call.id,
    ownerPhone: input.ownerPhone,
    whisperText: text,
  });
  if ((process.env.VOICE_PROVIDER ?? "photon") !== "twilio") {
    await photonVoice.forwardCall({
      callId: input.call.call_sid || input.call.conversation_id || input.call.id,
      ownerPhone: input.ownerPhone,
      whisperText: text,
    });
    const { error } = await supabase
      .from("calls")
      .update({ action: "forwarded" })
      .eq("id", input.call.id);
    if (error) throw new Error(error.message);
    await insertEvent(supabase, input.call.id, "action", {
      step: "photon_transfer",
      transfer_number: input.ownerPhone,
      whisper: text,
    });
    return {
      ownerCallSid: "",
      conferenceName: "",
      parentCallSid: input.call.call_sid || "",
      transferNumber: input.ownerPhone,
    };
  }

  const parentCallSid = input.call.call_sid;
  if (!parentCallSid) throw new Error("This call has no Twilio call SID");

  const statusCallbackUrl = `${appBase()}/api/twilio/owner-status?call_sid=${encodeURIComponent(parentCallSid)}`;
  const bridged = await bridgeTwilioConference({
    callSid: parentCallSid,
    ownerPhone: input.ownerPhone,
    whisperText: text,
    statusCallbackUrl,
  });

  const { error } = await supabase
    .from("calls")
    .update({ action: "forwarded" })
    .eq("id", input.call.id);
  if (error) throw new Error(error.message);

  await insertEvent(supabase, input.call.id, "action", {
    step: "caller_in_conference",
    conference: bridged.conferenceName,
    owner_call_sid: bridged.ownerCallSid,
  });

  return {
    ownerCallSid: bridged.ownerCallSid,
    conferenceName: bridged.conferenceName,
    parentCallSid,
  };
}

async function alreadyFellBack(
  supabase: SupabaseClient,
  callId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("call_events")
    .select("id")
    .eq("call_id", callId)
    .contains("payload", { step: "no_answer_fallback" })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

async function readDialReason(
  supabase: SupabaseClient,
  callId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("call_events")
    .select("payload")
    .eq("call_id", callId)
    .contains("payload", { step: "dialing_owner" })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const payload = data?.[0]?.payload as { reason?: string } | undefined;
  return payload?.reason ?? "They asked to be connected.";
}

export async function applyNoAnswerFallback(parentCallSid: string) {
  const supabase = serviceClient();
  const call = await getCallBySid(supabase, parentCallSid);
  if (!call) return;
  if (await alreadyFellBack(supabase, call.id)) return;

  const { data: claimed, error: claimError } = await supabase
    .from("calls")
    .update({ action: "message_taken" })
    .eq("id", call.id)
    .eq("action", "forwarded")
    .select("id");
  if (claimError) throw new Error(claimError.message);
  if (!claimed?.length) return;

  const reason = await readDialReason(supabase, call.id);
  try {
    await getTwilioClient().calls(parentCallSid).update({
      twiml: missedOwnerTwiml(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "twiml update failed";
    console.error("no-answer twiml", message);
  }

  const owner = await getOwner(supabase);
  const who = call.caller_name || call.caller_number || "an unknown caller";
  const body = `Missed call from ${who}. ${reason} I couldn't connect you, so this is the message.`;
  const address = owner.imessage_handle || owner.phone;
  const channel =
    (process.env.MESSAGING_PROVIDER ?? "photon") === "sms" ? "sms" : "imessage";
  let sendError: string | null = null;
  try {
    await getMessagingProvider().send(address, body);
  } catch (error) {
    sendError = error instanceof Error ? error.message : "send failed";
  }

  const { error: messageError } = await supabase.from("messages").insert({
    direction: "out",
    channel,
    address,
    body,
    call_id: call.id,
  });
  if (messageError) throw new Error(messageError.message);

  await insertEvent(supabase, call.id, "action", {
    step: "no_answer_fallback",
    reason,
    send_error: sendError,
  });
}

export async function waitForOwnerAnswer(result: ForwardResult) {
  await new Promise((resolve) => setTimeout(resolve, NO_ANSWER_WAIT_MS));
  try {
    const ownerCall = await getTwilioClient().calls(result.ownerCallSid).fetch();
    if (!NO_ANSWER_STATUSES.has(ownerCall.status)) return;
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    console.error("owner call status", message);
    return;
  }
  await applyNoAnswerFallback(result.parentCallSid);
}

import { photonVoice } from "@/lib/voice-photon";
import {
  insertEvent,
  serviceClient,
  type CallRow,
} from "@/app/api/tools/db";

export type ForwardResult = {
  ownerCallSid: string;
  conferenceName: string;
  parentCallSid: string;
  transferNumber?: string;
};

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

  const { error } = await supabase
    .from("calls")
    .update({
      action: "forwarded",
      ended_at: input.call.ended_at ?? new Date().toISOString(),
    })
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

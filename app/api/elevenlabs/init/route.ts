import { elevenLabsInitRequestSchema } from "@/lib/contracts";
import {
  getCallByConversation,
  getOwnerById,
  insertEvent,
  ownerForCalledNumber,
  isKnownContact,
  isNumberBlocked,
  json,
  normalizePhone,
  rejectIfUnauthorized,
  serviceClient,
} from "@/app/api/tools/db";

// Conversation initiation webhook. One Photon number serves every account.
// The name check later picks which person the caller asked for.
// https://elevenlabs.io/docs/eleven-agents/customization/personalization
export async function POST(req: Request) {
  const unauthorized = rejectIfUnauthorized(req);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = elevenLabsInitRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid body" }, 400);
  }

  const { caller_id, called_number, conversation_id } = parsed.data;
  const callSid = parsed.data.call_sid || parsed.data.call_id || "";
  const callerNumber = normalizePhone(caller_id);
  const calledNumber = normalizePhone(called_number);

  try {
    const supabase = serviceClient();
    const matched = await ownerForCalledNumber(supabase, calledNumber);
    const existing = await getCallByConversation(supabase, conversation_id);
    let callId = existing?.id ?? "";
    let ownerId = existing?.owner_id ?? matched?.id ?? null;
    if (existing?.owner_id) ownerId = existing.owner_id;
    if (!existing) {
      const { data: created, error } = await supabase
        .from("calls")
        .insert({
          owner_id: ownerId,
          conversation_id,
          call_sid: callSid,
          caller_number: callerNumber,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      callId = created.id;
    } else {
      const { error } = await supabase
        .from("calls")
        .update({
          owner_id: ownerId,
          call_sid: callSid || existing.call_sid,
          caller_number: callerNumber || existing.caller_number,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }

    const owner = ownerId ? await getOwnerById(supabase, ownerId) : null;
    const [blocked, known] = owner
      ? await Promise.all([
          isNumberBlocked(supabase, owner.id, callerNumber),
          isKnownContact(supabase, owner.id, callerNumber),
        ])
      : [false, false];

    await insertEvent(supabase, callId, "system", {
      step: "init",
      caller_number: callerNumber,
      called_number,
      call_sid: callSid,
      is_blocked: blocked,
      is_known_contact: known,
      owner_id: owner?.id ?? null,
    });

    return json({
      type: "conversation_initiation_client_data",
      dynamic_variables: {
        owner_name: owner?.name ?? "this number",
        caller_number: callerNumber,
        is_blocked: blocked,
        is_known_contact: known,
        call_sid: callSid,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "init failed";
    console.error("elevenlabs/init", message);
    return json({ error: message }, 500);
  }
}

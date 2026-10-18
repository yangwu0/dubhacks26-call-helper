import { elevenLabsInitRequestSchema } from "@/lib/contracts";
import { rejectIfBadSecret } from "@/lib/auth";
import { DEMO_PHOTON_NUMBER } from "@/lib/owner-phone";
import {
  getCallByConversation,
  getOwnerById,
  insertEvent,
  ownerForCalledNumber,
  isKnownContact,
  isNumberFlagged,
  json,
  normalizePhone,
  serviceClient,
} from "@/app/api/tools/db";

// Conversation initiation webhook. One Photon number serves every account.
// The name check later picks which person the caller asked for.
// https://elevenlabs.io/docs/eleven-agents/customization/personalization
export async function POST(req: Request) {
  const unauthorized = rejectIfBadSecret(req);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = elevenLabsInitRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.error("elevenlabs/init invalid body", parsed.error.message, body);
    return json({ error: "invalid body" }, 400);
  }

  const caller_id = parsed.data.caller_id ?? "";
  const called_number = parsed.data.called_number ?? "";
  const conversation_id =
    parsed.data.conversation_id?.trim() ||
    `conv_${parsed.data.call_sid || parsed.data.call_id || Date.now()}`;
  const callSid = parsed.data.call_sid || parsed.data.call_id || "";
  const callerNumber = normalizePhone(caller_id);
  const calledNumber = normalizePhone(called_number);

  try {
    const supabase = serviceClient();
    const matched = calledNumber
      ? await ownerForCalledNumber(supabase, calledNumber)
      : null;
    const existing = await getCallByConversation(supabase, conversation_id);
    let callId = existing?.id ?? "";
    let ownerId = existing?.owner_id ?? matched?.id ?? null;
    if (existing?.owner_id) ownerId = existing.owner_id;
    // Demo fallback: attach orphaned inbound calls to the shared Photon line owner.
    if (!ownerId) {
      const { data: demoOwner } = await supabase
        .from("owners")
        .select("id")
        .eq("photon_number", DEMO_PHOTON_NUMBER)
        .limit(1)
        .maybeSingle();
      ownerId = demoOwner?.id ?? null;
    }
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
    const [flagged, known] = owner
      ? await Promise.all([
          isNumberFlagged(supabase, owner.id, callerNumber),
          isKnownContact(supabase, owner.id, callerNumber),
        ])
      : [false, false];

    await insertEvent(supabase, callId, "system", {
      step: "init",
      caller_number: callerNumber,
      called_number,
      call_sid: callSid,
      is_blocked: flagged,
      is_known_contact: known,
      owner_id: owner?.id ?? null,
    });

    return json({
      type: "conversation_initiation_client_data",
      dynamic_variables: {
        owner_name: owner?.name ?? "this number",
        caller_number: callerNumber,
        is_blocked: flagged,
        is_known_contact: known,
        call_sid: callSid,
        // Temporary always-true flag for agent prompt testing; replace later.
        temp_flag: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "init failed";
    console.error("elevenlabs/init", message);
    return json({ error: message }, 500);
  }
}

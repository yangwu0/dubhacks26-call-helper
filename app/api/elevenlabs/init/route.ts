import { elevenLabsInitRequestSchema } from "@/lib/contracts";
import {
  getOwner,
  insertEvent,
  isKnownContact,
  isNumberBlocked,
  json,
  normalizePhone,
  rejectIfUnauthorized,
  serviceClient,
} from "@/app/api/tools/db";

// Conversation initiation webhook. Runs for Photon SIP trunk calls and Twilio.
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

  try {
    const supabase = serviceClient();
    const owner = await getOwner(supabase);
    const [blocked, known] = await Promise.all([
      isNumberBlocked(supabase, callerNumber),
      isKnownContact(supabase, callerNumber),
    ]);

    const { data: call, error } = await supabase
      .from("calls")
      .upsert(
        {
          owner_id: owner.id,
          conversation_id,
          call_sid: callSid,
          caller_number: callerNumber,
        },
        { onConflict: "conversation_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await insertEvent(supabase, call.id, "system", {
      step: "init",
      caller_number: callerNumber,
      called_number,
      call_sid: callSid,
      is_blocked: blocked,
      is_known_contact: known,
    });

    return json({
      type: "conversation_initiation_client_data",
      dynamic_variables: {
        owner_name: owner.name,
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

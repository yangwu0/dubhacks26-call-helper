import { takeMessageRequestSchema } from "@/lib/contracts";
import {
  getCallByConversation,
  insertEvent,
  json,
  rejectIfUnauthorized,
  serviceClient,
} from "@/app/api/tools/db";

export async function POST(req: Request) {
  const unauthorized = rejectIfUnauthorized(req);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = takeMessageRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const { conversation_id, caller_name, callback_number, message } =
    parsed.data;

  try {
    const supabase = serviceClient();
    const call = await getCallByConversation(supabase, conversation_id);
    if (!call) return json({ error: "unknown conversation" }, 404);

    const storedSummary = message.trim();
    const update: Record<string, unknown> = {
      caller_name,
      caller_intent: storedSummary,
      summary: storedSummary,
    };
    if (!call.action || call.action === "none") {
      update.action = "message_taken";
    }
    const { error } = await supabase
      .from("calls")
      .update(update)
      .eq("id", call.id);
    if (error) throw new Error(error.message);

    await insertEvent(supabase, call.id, "tool", {
      tool: "take_message",
      caller_name,
      callback_number,
      message,
    });

    return json({ ok: true });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "message failed";
    console.error("take_message", messageText);
    return json({ error: messageText }, 500);
  }
}

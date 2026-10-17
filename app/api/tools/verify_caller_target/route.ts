import { verifyCallerTargetRequestSchema } from "@/lib/contracts";
import {
  getCallByConversation,
  getOwner,
  insertEvent,
  json,
  rejectIfUnauthorized,
  serviceClient,
} from "@/app/api/tools/db";
import { fuzzyMatchName } from "@/app/api/tools/match";

export async function POST(req: Request) {
  const unauthorized = rejectIfUnauthorized(req);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = verifyCallerTargetRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const { conversation_id, claimed_target } = parsed.data;

  try {
    const supabase = serviceClient();
    const [owner, call] = await Promise.all([
      getOwner(supabase),
      getCallByConversation(supabase, conversation_id),
    ]);
    if (!call) return json({ error: "unknown conversation" }, 404);

    const result = fuzzyMatchName(
      claimed_target,
      owner.name,
      owner.aliases ?? [],
    );

    const { error } = await supabase
      .from("calls")
      .update({
        claimed_target,
        target_match: result.match,
      })
      .eq("id", call.id);
    if (error) throw new Error(error.message);

    await insertEvent(supabase, call.id, "tool", {
      tool: "verify_caller_target",
      claimed_target,
      match: result.match,
      confidence: result.confidence,
      matched_against: result.matchedAgainst,
    });

    return json({ match: result.match, confidence: result.confidence });
  } catch (error) {
    const message = error instanceof Error ? error.message : "verify failed";
    console.error("verify_caller_target", message);
    return json({ error: message }, 500);
  }
}

import { verifyCallerTargetRequestSchema } from "@/lib/contracts";
import { fuzzyMatchName } from "@/app/api/tools/match";
import {
  getCallByConversation,
  insertEvent,
  json,
  listOwners,
  ownerForCall,
  rejectIfUnauthorized,
  serviceClient,
  type OwnerRow,
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

  const parsed = verifyCallerTargetRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const { conversation_id, claimed_target } = parsed.data;

  try {
    const supabase = serviceClient();
    const call = await getCallByConversation(supabase, conversation_id);
    if (!call) return json({ error: "unknown conversation" }, 404);

    const assigned = await ownerForCall(supabase, call);
    const candidates = assigned
      ? [assigned]
      : (await listOwners(supabase)).filter(
          (owner) => owner.name.trim() && owner.phone.trim().startsWith("+"),
        );
    const ranked = candidates
      .map((owner) => ({
        owner,
        result: fuzzyMatchName(claimed_target, owner.name, owner.aliases ?? []),
      }))
      .sort((left, right) => right.result.confidence - left.result.confidence);
    const best = ranked[0];
    const second = ranked[1];
    const tied = Boolean(
      best?.result.match &&
        second?.result.match &&
        second.result.confidence === best.result.confidence,
    );
    const chosen = best?.result.match && !tied ? best.owner : null;
    const owner: OwnerRow | null = chosen ?? assigned;
    const result = chosen && best
      ? best.result
      : { match: false, confidence: best?.result.confidence ?? 0, matchedAgainst: null };

    const { error } = await supabase
      .from("calls")
      .update({
        claimed_target,
        target_match: result.match,
        ...(result.match && owner ? { owner_id: owner.id } : {}),
      })
      .eq("id", call.id);
    if (error) throw new Error(error.message);

    await insertEvent(supabase, call.id, "tool", {
      tool: "verify_caller_target",
      claimed_target,
      match: result.match,
      confidence: result.confidence,
      matched_against: result.matchedAgainst,
      owner_id: owner?.id ?? null,
    });

    return json({ match: result.match, confidence: result.confidence });
  } catch (error) {
    const message = error instanceof Error ? error.message : "verify failed";
    console.error("verify_caller_target", message);
    return json({ error: message }, 500);
  }
}

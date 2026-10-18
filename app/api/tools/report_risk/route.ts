import { reportRiskRequestSchema } from "@/lib/contracts";
import { applyRiskRules } from "@/lib/scoring";
import {
  asStringArray,
  getCallByConversation,
  insertEvent,
  isNumberFlagged,
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

  const parsed = reportRiskRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const { conversation_id, score, reasons, caller_intent, caller_name } =
    parsed.data;

  try {
    const supabase = serviceClient();
    const call = await getCallByConversation(supabase, conversation_id);
    if (!call) return json({ error: "unknown conversation" }, 404);

    const flagged =
      call.owner_id && call.caller_number
        ? await isNumberFlagged(supabase, call.owner_id, call.caller_number)
        : false;
    const decision = applyRiskRules({
      reportedScore: score,
      previousScore: call.risk_score ?? 0,
      reasons,
      isBlocked: flagged,
      targetMatch: call.target_match,
    });

    const update: Record<string, unknown> = {
      risk_score: decision.score,
      risk_reasons: decision.rejectedDrop
        ? asStringArray(call.risk_reasons)
        : decision.reasons,
      summary: caller_intent,
    };
    if (caller_name) update.caller_name = caller_name;
    // Mark scam path on the row so the dashboard leaves "Screening" even if post-call is late.
    if (decision.recommendedAction === "end_as_scam") {
      update.action = "blocked";
      update.classification = "scam";
    }

    const { error } = await supabase
      .from("calls")
      .update(update)
      .eq("id", call.id);
    if (error) throw new Error(error.message);

    await insertEvent(supabase, call.id, "risk", {
      reported_score: score,
      score: decision.score,
      reasons,
      caller_intent,
      caller_name: caller_name ?? null,
      rejected_drop: decision.rejectedDrop,
      is_blocked: flagged,
      recommended_action: decision.recommendedAction,
    });

    return json({
      ok: true,
      recommended_action: decision.recommendedAction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "risk failed";
    console.error("report_risk", message);
    return json({ error: message }, 500);
  }
}

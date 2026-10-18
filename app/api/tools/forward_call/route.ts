import { forwardCallRequestSchema } from "@/lib/contracts";
import { FORWARD_MAX_SCORE } from "@/lib/scoring";
import { startForward } from "@/lib/forward";
import {
  getCallByConversation,
  insertEvent,
  ownerForCall,
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

  const parsed = forwardCallRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const { conversation_id, reason, urgency } = parsed.data;

  try {
    const supabase = serviceClient();
    const call = await getCallByConversation(supabase, conversation_id);
    if (!call) return json({ error: "unknown conversation" }, 404);

    const score = call.risk_score ?? 0;
    if (call.target_match !== true || score >= FORWARD_MAX_SCORE) {
      const message =
        call.target_match !== true
          ? "Refusing to connect. The name did not match."
          : `Refusing to connect. The risk score is ${score}.`;
      await insertEvent(supabase, call.id, "tool", {
        tool: "forward_call",
        ok: false,
        message,
        reason,
        urgency,
        target_match: call.target_match,
        risk_score: score,
      });
      return json({ ok: false, message });
    }

    const owner = await ownerForCall(supabase, call);
    if (!owner) {
      const message = "Refusing to connect. Sift could not tell who this caller asked for.";
      await insertEvent(supabase, call.id, "tool", {
        tool: "forward_call",
        ok: false,
        message,
        reason,
        urgency,
      });
      return json({ ok: false, message });
    }
    const result = await startForward({
      call,
      ownerPhone: owner.phone,
      reason,
      urgency,
    });

    const message = "Connecting you now.";
    await insertEvent(supabase, call.id, "tool", {
      tool: "forward_call",
      ok: true,
      message,
      reason,
      urgency,
      transfer_number: result.transferNumber ?? null,
    });
    return json({
      ok: true,
      message,
      ...(result.transferNumber
        ? { transfer_number: result.transferNumber }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "forward failed";
    console.error("forward_call", message);
    try {
      const supabase = serviceClient();
      const call = await getCallByConversation(supabase, conversation_id);
      if (call) {
        await insertEvent(supabase, call.id, "tool", {
          tool: "forward_call",
          ok: false,
          message,
          reason,
          urgency,
        });
      }
    } catch (logError) {
      console.error("forward_call log", logError);
    }
    return json({ ok: false, message });
  }
}

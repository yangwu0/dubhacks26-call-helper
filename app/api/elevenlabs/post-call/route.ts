import { after } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { formatPostCallMessage, summarize } from "@/lib/anthropic";
import { postCallWebhookSchema, type PostCallWebhook } from "@/lib/contracts";
import { SCAM_SCORE, classifyCall } from "@/lib/scoring";
import { verifySecret } from "@/lib/auth";
import {
  asStringArray,
  getCallByConversation,
  insertEvent,
  json,
  saveTranscriptTurns,
  serviceClient,
  type CallRow,
  type TranscriptTurn,
} from "@/app/api/tools/db";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeEvent(event: unknown): unknown {
  if (!event || typeof event !== "object") return event;
  const record = event as {
    type?: string;
    data?: { transcript?: unknown };
  };
  if (record.type !== "post_call_transcription" || !Array.isArray(record.data?.transcript)) {
    return event;
  }
  record.data.transcript = record.data.transcript.map((turn) => {
    if (!turn || typeof turn !== "object") return turn;
    const copy = { ...(turn as Record<string, unknown>) };
    if (copy.message === null) delete copy.message;
    return copy;
  });
  return record;
}

function transcriptText(
  turns: { role: string; message?: string }[] | undefined,
): string {
  return (turns ?? [])
    .map((turn) => `${turn.role}: ${turn.message ?? ""}`.trim())
    .filter((line) => !line.endsWith(":"))
    .join("\n");
}

function callerLabel(call: CallRow): string {
  return call.caller_name || call.caller_number || "unknown caller";
}

async function finishTranscription(
  supabase: SupabaseClient,
  event: Extract<PostCallWebhook, { type: "post_call_transcription" }>,
) {
  const call = await getCallByConversation(
    supabase,
    event.data.conversation_id,
  );
  if (!call) {
    console.error("post-call missing call", event.data.conversation_id);
    return;
  }

  const transcriptTurns = event.data.transcript ?? [];
  const text = transcriptText(transcriptTurns);
  const storedTurns: TranscriptTurn[] = transcriptTurns.flatMap((turn) => {
    const line = turn.message?.trim() ?? "";
    if (!line) return [];
    return [
      {
        role: turn.role === "agent" ? "agent" : "caller",
        text: line,
        timeInCallSecs: turn.time_in_call_secs,
      } satisfies TranscriptTurn,
    ];
  });
  await saveTranscriptTurns(supabase, call.id, storedTurns);

  const decision = classifyCall({
    riskScore: call.risk_score ?? 0,
    targetMatch: call.target_match,
    action: call.action,
    callerIntent: call.caller_intent,
  });

  let summary: string;
  let classification = decision.classification;
  let action = decision.action;
  try {
    const written = await summarize(text, {
      caller_name: call.caller_name,
      caller_number: call.caller_number,
      caller_intent: call.caller_intent,
      risk_score: call.risk_score,
      risk_reasons: asStringArray(call.risk_reasons),
      action: call.action,
      target_match: call.target_match,
    });
    summary = formatPostCallMessage(written);
    classification = written.classification;
    if (written.suggested_action === "block") action = "blocked";
    else if (written.suggested_action === "book") action = "booked";
    else if (written.suggested_action === "forward") action = "forwarded";
    else if (written.suggested_action === "take_message") action = "message_taken";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "summarize failed";
    summary = `Call from ${callerLabel(call)}. A written summary is unavailable (${reason}).`;
    console.error("summarize", reason);
  }

  const isScam = classification === "scam" || (call.risk_score ?? 0) >= SCAM_SCORE;

  const { error } = await supabase
    .from("calls")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      transcript: storedTurns.map((turn) => ({
        role: turn.role,
        message: turn.text,
        time_in_call_secs: turn.timeInCallSecs ?? null,
      })),
      summary,
      classification,
      action,
    })
    .eq("id", call.id);
  if (error) throw new Error(error.message);

  if (isScam && call.caller_number && call.owner_id) {
    const reason =
      asStringArray(call.risk_reasons).join("; ") || "Classified as a scam";
    const { error: blockError } = await supabase.from("blocked_numbers").upsert(
      { number: call.caller_number, reason, owner_id: call.owner_id },
      { onConflict: "owner_id,number" },
    );
    if (blockError) throw new Error(blockError.message);
  }

  await insertEvent(supabase, call.id, "action", {
    step: "summary_saved",
    summary,
  });
}

async function finishFailure(
  supabase: SupabaseClient,
  event: Extract<PostCallWebhook, { type: "call_initiation_failure" }>,
) {
  const call = await getCallByConversation(
    supabase,
    event.data.conversation_id,
  );
  if (!call) return;
  const { error } = await supabase
    .from("calls")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", call.id);
  if (error) throw new Error(error.message);
  await insertEvent(supabase, call.id, "system", {
    step: "call_initiation_failure",
    failure_reason: event.data.failure_reason,
  });
}

async function processPostCall(event: PostCallWebhook) {
  const supabase = serviceClient();
  if (event.type === "post_call_transcription") {
    await finishTranscription(supabase, event);
    return;
  }
  if (event.type === "call_initiation_failure") {
    await finishFailure(supabase, event);
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const providedSecret = req.headers.get("x-sift-secret");
  if (providedSecret !== null && !verifySecret(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  const signature = req.headers.get("elevenlabs-signature");
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return json({ error: "unauthorized" }, 401);
  }

  let event: unknown;
  try {
    const elevenlabs = new ElevenLabsClient();
    event = await elevenlabs.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid signature";
    console.error("post-call signature", message);
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = postCallWebhookSchema.safeParse(normalizeEvent(event));
  after(async () => {
    if (!parsed.success) {
      console.error("post-call shape", parsed.error.message);
      return;
    }
    try {
      await processPostCall(parsed.data);
    } catch (error) {
      console.error(
        "post-call",
        error instanceof Error ? error.message : error,
      );
    }
  });

  return json({ received: true });
}

import { after } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { summarize } from "@/lib/anthropic";
import { postCallWebhookSchema, type PostCallWebhook } from "@/lib/contracts";
import { getMessagingProvider } from "@/lib/messaging";
import { SCAM_SCORE, classifyCall } from "@/lib/scoring";
import { verifySecret } from "@/lib/auth";
import {
  asStringArray,
  getCallByConversation,
  getOwner,
  insertEvent,
  json,
  serviceClient,
  type CallRow,
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

function messageBodyForOwner(call: CallRow): string {
  const who = callerLabel(call);
  const intent = call.caller_intent?.trim();
  if (intent) return `Message from ${who}: ${intent}`;
  return `Call from ${who}. Sift took a message but no text was captured.`;
}

async function sendToOwner(
  supabase: SupabaseClient,
  call: CallRow,
  body: string,
) {
  const owner = await getOwner(supabase);
  const address = owner.imessage_handle || owner.phone;
  const channel = "imessage";
  let sendError: string | null = null;
  try {
    await getMessagingProvider().send(address, body);
  } catch (error) {
    sendError = error instanceof Error ? error.message : "send failed";
  }
  const { error } = await supabase.from("messages").insert({
    direction: "out",
    channel,
    address,
    body,
    call_id: call.id,
  });
  if (error) throw new Error(error.message);
  await insertEvent(supabase, call.id, "action", {
    step: "summary_sent",
    send_error: sendError,
  });
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

  const decision = classifyCall({
    riskScore: call.risk_score ?? 0,
    targetMatch: call.target_match,
    action: call.action,
    callerIntent: call.caller_intent,
  });

  const isScam =
    decision.classification === "scam" || (call.risk_score ?? 0) >= SCAM_SCORE;

  let summary: string;
  if (isScam) {
    try {
      summary = await summarize(text);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "summarize failed";
      summary = `Scam call from ${callerLabel(call)}. Risk ${call.risk_score ?? 0}. ${asStringArray(call.risk_reasons).join("; ") || "Flagged as high risk."} (Summary unavailable: ${reason})`;
      console.error("summarize", reason);
    }
  } else if (call.summary?.trim()) {
    summary = call.summary.trim();
  } else if (call.caller_intent?.trim()) {
    summary = call.caller_intent.trim();
  } else if (call.action === "forwarded" || call.action === "booked") {
    summary = `Call from ${callerLabel(call)} was connected. ${call.caller_intent?.trim() || "No message stored."}`;
  } else {
    summary = messageBodyForOwner(call);
  }

  const { error } = await supabase
    .from("calls")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      transcript: null,
      summary,
      classification: decision.classification,
      action: decision.action,
    })
    .eq("id", call.id);
  if (error) throw new Error(error.message);

  if (isScam && call.caller_number) {
    const reason =
      asStringArray(call.risk_reasons).join("; ") || "Classified as a scam";
    const { error: blockError } = await supabase.from("blocked_numbers").upsert(
      { number: call.caller_number, reason },
      { onConflict: "number" },
    );
    if (blockError) throw new Error(blockError.message);
  }

  const messageAlreadySent = call.action === "message_taken";
  if (isScam) {
    await sendToOwner(supabase, call, summary);
  } else if (!messageAlreadySent) {
    await sendToOwner(supabase, call, messageBodyForOwner(call));
  }
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

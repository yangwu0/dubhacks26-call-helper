import twilio from "twilio";
import { verifySecret } from "@/lib/auth";
import { applyNoAnswerFallback } from "@/lib/forward";
import {
  getCallBySid,
  insertEvent,
  json,
  serviceClient,
} from "@/app/api/tools/db";

const NO_ANSWER = new Set(["no-answer", "busy", "failed", "canceled"]);

export async function POST(req: Request) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const secretOk = verifySecret(req);
  const token = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const requestUrl = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const signedUrl = base
    ? `${base}${requestUrl.pathname}${requestUrl.search}`
    : req.url;
  const signatureOk =
    Boolean(token) &&
    Boolean(signature) &&
    twilio.validateRequest(token as string, signature, signedUrl, params);

  if (!secretOk && !signatureOk) {
    return json({ error: "unauthorized" }, 401);
  }

  const parentCallSid = requestUrl.searchParams.get("call_sid") ?? "";
  const status = params.CallStatus ?? "";
  if (!parentCallSid) return json({ error: "missing call_sid" }, 400);

  try {
    const supabase = serviceClient();
    const call = await getCallBySid(supabase, parentCallSid);
    if (call) {
      await insertEvent(supabase, call.id, "system", {
        step: "owner_status",
        call_status: status,
        owner_call_sid: params.CallSid ?? null,
      });
    }
    if (NO_ANSWER.has(status)) {
      await applyNoAnswerFallback(parentCallSid);
    }
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "status failed";
    console.error("twilio/owner-status", message);
    return json({ error: message }, 500);
  }
}

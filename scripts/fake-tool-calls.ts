/**
 * Curl every Sift tool, plus init and post-call, against a running app.
 *
 *   pnpm dev
 *   node --env-file=.env --import tsx scripts/fake-tool-calls.ts
 *
 * Requires SIFT_WEBHOOK_SECRET, ELEVENLABS_WEBHOOK_SECRET, and Supabase
 * service-role env vars. Prints the rows it created.
 */
import { execFile } from "node:child_process";
import { createHmac } from "node:crypto";
import { promisify } from "node:util";
import { createServiceClient } from "../lib/supabase";

const exec = promisify(execFile);
const base = (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const secret = process.env.SIFT_WEBHOOK_SECRET ?? "";
const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET ?? "";
const runId = `fake-${Date.now()}`;

type CurlResult = { status: number; body: unknown; raw: string };

function sign(rawBody: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v0=${digest}`;
}

async function curl(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<CurlResult> {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const args = [
    "-sS",
    "-m",
    "20",
    "-w",
    "\n%{http_code}",
    "-X",
    "POST",
    `${base}${path}`,
    "-H",
    "content-type: application/json",
    "-H",
    `x-sift-secret: ${secret}`,
  ];
  for (const [name, value] of Object.entries(headers)) {
    args.push("-H", `${name}: ${value}`);
  }
  args.push("-d", raw);
  const { stdout } = await exec("curl", args);
  const breakAt = stdout.lastIndexOf("\n");
  const payload = stdout.slice(0, breakAt);
  const status = Number(stdout.slice(breakAt + 1));
  let parsed: unknown = payload;
  try {
    parsed = JSON.parse(payload);
  } catch {
    parsed = payload;
  }
  return { status, body: parsed, raw: payload };
}

function assert(label: string, result: CurlResult, ok: (body: unknown) => boolean) {
  const passed = result.status === 200 && ok(result.body);
  console.log(`${passed ? "ok" : "FAIL"} ${label} HTTP ${result.status} ${result.raw}`);
  if (!passed) {
    throw new Error(label);
  }
}

async function main() {
  if (!secret || !webhookSecret) {
    throw new Error(
      "Set SIFT_WEBHOOK_SECRET and ELEVENLABS_WEBHOOK_SECRET before running.",
    );
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. These tools write rows in Supabase.",
    );
  }

  const legit = `${runId}-legit`;
  const scam = `${runId}-scam`;
  const forward = `${runId}-forward`;

  const init = await curl("/api/elevenlabs/init", {
    caller_id: "+1 (206) 555-1001",
    agent_id: "agent_fake",
    called_number: "+15550001111",
    call_sid: `CA${runId}legit`,
    conversation_id: legit,
  });
  assert("init", init, (body) => {
    const data = body as { dynamic_variables?: { owner_name?: string } };
    return Boolean(data.dynamic_variables?.owner_name);
  });

  assert(
    "verify match",
    await curl("/api/tools/verify_caller_target", {
      conversation_id: legit,
      claimed_target: "Aleks Kim",
    }),
    (body) => (body as { match?: boolean }).match === true,
  );

  assert(
    "report low risk",
    await curl("/api/tools/report_risk", {
      conversation_id: legit,
      score: 18,
      reasons: ["Named Alex Kim", "Building maintenance"],
      caller_intent: "Schedule a kitchen-leak repair",
      caller_name: "Dana Ruiz",
    }),
    (body) =>
      (body as { recommended_action?: string }).recommended_action ===
      "may_forward",
  );

  const availability = await curl("/api/tools/check_availability", {
    conversation_id: legit,
    date_from: "2026-10-19",
    date_to: "2026-10-23",
  });
  assert(
    "check availability",
    availability,
    (body) => Array.isArray((body as { free_slots?: unknown }).free_slots),
  );
  const slots = (
    availability.body as { free_slots: { start: string; end: string }[] }
  ).free_slots;
  const slot = slots.find((item) => item.start.includes("T10:30")) ?? slots[0];
  if (!slot) throw new Error("no free slot returned");
  const slotStart = new Date(slot.start);
  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

  assert(
    "book event",
    await curl("/api/tools/book_event", {
      conversation_id: legit,
      title: "Landlord: kitchen leak",
      starts_at: slotStart.toISOString(),
      ends_at: slotEnd.toISOString(),
      caller_name: "Dana Ruiz",
    }),
    (body) =>
      (body as { ok?: boolean; event_id?: string }).ok === true &&
      Boolean((body as { event_id?: string }).event_id),
  );

  assert(
    "take message",
    await curl("/api/tools/take_message", {
      conversation_id: legit,
      caller_name: "Dana Ruiz",
      callback_number: "+12065551010",
      message: "The kitchen leak can wait until the booked window.",
    }),
    (body) => (body as { ok?: boolean }).ok === true,
  );

  assert(
    "init scam",
    await curl("/api/elevenlabs/init", {
      caller_id: "+18005550999",
      agent_id: "agent_fake",
      called_number: "+15550001111",
      call_sid: `CA${runId}scam`,
      conversation_id: scam,
    }),
    (body) =>
      (body as { dynamic_variables?: { is_blocked?: boolean } })
        .dynamic_variables?.is_blocked === false,
  );

  assert(
    "verify mismatch",
    await curl("/api/tools/verify_caller_target", {
      conversation_id: scam,
      claimed_target: "the homeowner",
    }),
    (body) => (body as { match?: boolean }).match === false,
  );

  assert(
    "report scam",
    await curl("/api/tools/report_risk", {
      conversation_id: scam,
      score: 90,
      reasons: ["Claimed to be the IRS", "Demanded gift cards"],
      caller_intent: "Collect a fake tax debt",
      caller_name: "Officer Grant",
    }),
    (body) =>
      (body as { recommended_action?: string }).recommended_action ===
      "end_as_scam",
  );

  assert(
    "forward refused",
    await curl("/api/tools/forward_call", {
      conversation_id: scam,
      reason: "They say it is the IRS",
      urgency: "immediate",
    }),
    (body) => (body as { ok?: boolean }).ok === false,
  );

  assert(
    "init forward",
    await curl("/api/elevenlabs/init", {
      caller_id: "+12065551010",
      agent_id: "agent_fake",
      called_number: "+15550001111",
      call_sid: `CA${runId}forward`,
      conversation_id: forward,
    }),
    (body) => Boolean((body as { type?: string }).type),
  );
  assert(
    "verify forward",
    await curl("/api/tools/verify_caller_target", {
      conversation_id: forward,
      claimed_target: "Alex",
    }),
    (body) => (body as { match?: boolean }).match === true,
  );
  assert(
    "report forward",
    await curl("/api/tools/report_risk", {
      conversation_id: forward,
      score: 12,
      reasons: ["Landlord, name matched"],
      caller_intent: "Schedule a kitchen-leak repair",
      caller_name: "Dana Ruiz",
    }),
    (body) =>
      (body as { recommended_action?: string }).recommended_action ===
      "may_forward",
  );
  const forwarded = await curl("/api/tools/forward_call", {
    conversation_id: forward,
    reason: "a kitchen leak",
    urgency: "tomorrow",
  });
  console.log(
    `info forward HTTP ${forwarded.status} ${forwarded.raw} (Twilio credentials are required for ok true)`,
  );

  const postBody = {
    type: "post_call_transcription",
    event_timestamp: Math.floor(Date.now() / 1000),
    data: {
      agent_id: "agent_fake",
      conversation_id: scam,
      status: "done",
      transcript: [
        {
          role: "agent",
          message:
            "Hi, this is an AI assistant. This call may be recorded. Who are you trying to reach?",
        },
        {
          role: "user",
          message:
            "This is Officer Grant with the IRS. You will be arrested unless you buy gift cards.",
        },
      ],
    },
  };
  const rawPost = JSON.stringify(postBody);
  const posted = await curl("/api/elevenlabs/post-call", rawPost, {
    "elevenlabs-signature": sign(rawPost),
  });
  assert("post-call", posted, (body) => (body as { received?: boolean }).received === true);

  await new Promise((resolve) => setTimeout(resolve, 1500));
  const supabase = createServiceClient();
  const ids = [legit, scam, forward];
  const calls = await supabase
    .from("calls")
    .select(
      "id, conversation_id, caller_number, target_match, risk_score, action, classification, summary",
    )
    .in("conversation_id", ids);
  if (calls.error) throw new Error(calls.error.message);
  console.log("calls", JSON.stringify(calls.data, null, 2));

  const callIds = (calls.data ?? []).map((row) => row.id);
  const events = await supabase
    .from("call_events")
    .select("call_id, type, payload")
    .in("call_id", callIds);
  if (events.error) throw new Error(events.error.message);
  console.log(`call_events ${events.data?.length ?? 0}`);

  const scamRow = (calls.data ?? []).find((row) => row.conversation_id === scam);
  if (!scamRow || scamRow.classification !== "scam") {
    throw new Error("scam call was not classified");
  }
  const blocked = await supabase
    .from("blocked_numbers")
    .select("number, reason")
    .eq("number", "+18005550999")
    .maybeSingle();
  if (blocked.error) throw new Error(blocked.error.message);
  console.log("blocked", JSON.stringify(blocked.data));
  if (!blocked.data) throw new Error("scam number was not blocked");
  console.log(`Done. Look up conversation ids starting with ${runId}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

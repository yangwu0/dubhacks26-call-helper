import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOwner,
  insertEvent,
  normalizePhone,
  serviceClient,
} from "@/app/api/tools/db";
import { getAnthropicClient, writeWeeklyParagraph } from "@/lib/anthropic";
import { getVoiceProvider } from "@/lib/voice";

const COMMANDS = ["CALL", "BLOCK", "UNBLOCK", "ADD", "UNDO", "REPORT"] as const;
type CommandName = (typeof COMMANDS)[number];

export type CommandContext = {
  supabase?: SupabaseClient;
  reply: (body: string) => Promise<void>;
  numberOverride?: string;
};

export type CommandResult = {
  command: CommandName | "question" | "help";
  ok: boolean;
};

type CallRecord = {
  id: string;
  caller_number: string | null;
  caller_name: string | null;
  status: string | null;
  call_sid: string | null;
  summary: string | null;
  classification: string | null;
  action: string | null;
  started_at: string | null;
};

function db(ctx: CommandContext): SupabaseClient {
  return ctx.supabase ?? serviceClient();
}

function commandName(text: string): CommandName | null {
  const word = text
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^a-z]/gi, "")
    .toUpperCase();
  if (!word) return null;
  return COMMANDS.find((command) => command === word) ?? null;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function latestCall(supabase: SupabaseClient): Promise<CallRecord | null> {
  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, caller_number, caller_name, status, call_sid, summary, classification, action, started_at",
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRecord | null) ?? null;
}

async function note(
  supabase: SupabaseClient,
  callId: string,
  payload: Record<string, unknown>,
) {
  await insertEvent(supabase, callId, "action", payload);
}

function targetNumber(call: CallRecord | null, override?: string): string | null {
  const raw = override || call?.caller_number;
  if (!raw) return null;
  const number = normalizePhone(raw);
  return number || null;
}

async function placeCallback(toNumber: string, reason: string) {
  const client = new ElevenLabsClient({
    apiKey: required("ELEVENLABS_API_KEY"),
  });
  await client.conversationalAi.sipTrunk.outboundCall({
    agentId: required("ELEVENLABS_AGENT_ID"),
    agentPhoneNumberId: required("ELEVENLABS_PHONE_NUMBER_ID"),
    toNumber,
    conversationInitiationClientData: {
      conversationConfigOverride: {
        agent: { firstMessage: reason },
      },
    },
  });
}

async function handleCall(
  supabase: SupabaseClient,
  ctx: CommandContext,
  call: CallRecord | null,
) {
  const number = targetNumber(call, ctx.numberOverride);
  if (!call || !number) {
    await ctx.reply("The last call has no number to call back.");
    return;
  }
  const who = call.caller_name || number;
  if (call.status === "in_progress" && call.call_sid) {
    const owner = await getOwner(supabase);
    await getVoiceProvider().forwardCall({
      callId: call.call_sid,
      ownerPhone: owner.phone,
      whisperText: `Call from ${who}. You asked to join.`,
    });
    await note(supabase, call.id, { command: "CALL", live: true });
    await ctx.reply(
      "I can't conference you into the live Photon call from iMessage. Spectrum has no conference control. The agent can still transfer with its transfer number while the call is up.",
    );
    return;
  }
  const reason = `The owner asked me to call you back about the earlier call with ${who}.`;
  await placeCallback(number, reason);
  await note(supabase, call.id, { command: "CALL", to: number });
  await ctx.reply(`Calling ${who} back through the Photon line.`);
}

async function handleBlock(
  supabase: SupabaseClient,
  ctx: CommandContext,
  call: CallRecord | null,
  block: boolean,
) {
  const number = targetNumber(call, ctx.numberOverride);
  if (!number) {
    await ctx.reply(
      block
        ? "The last call has no number to block."
        : "The last call has no number to unblock.",
    );
    return;
  }
  if (block) {
    const { error } = await supabase.from("blocked_numbers").upsert(
      { number, reason: "Owner replied BLOCK" },
      { onConflict: "number" },
    );
    if (error) throw new Error(error.message);
    if (call) await note(supabase, call.id, { command: "BLOCK", number });
    await ctx.reply(`Blocked ${number}.`);
    return;
  }
  const { error } = await supabase
    .from("blocked_numbers")
    .delete()
    .eq("number", number);
  if (error) throw new Error(error.message);
  if (call) await note(supabase, call.id, { command: "UNBLOCK", number });
  await ctx.reply(`Unblocked ${number}.`);
}

type Proposal = { title: string; starts_at: string; ends_at: string };

function proposalFrom(payload: unknown): Proposal | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.starts_at !== "string" ||
    typeof record.ends_at !== "string"
  ) {
    return null;
  }
  return {
    title: record.title,
    starts_at: record.starts_at,
    ends_at: record.ends_at,
  };
}

async function handleAdd(
  supabase: SupabaseClient,
  ctx: CommandContext,
  call: CallRecord | null,
) {
  if (!call) {
    await ctx.reply("There is no recent call with a proposed time.");
    return;
  }
  const { data, error } = await supabase
    .from("call_events")
    .select("payload")
    .eq("call_id", call.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const proposal = (data ?? [])
    .map((row) => proposalFrom(row.payload))
    .find((item): item is Proposal => item !== null);
  if (!proposal) {
    await ctx.reply("The last call doesn't have a proposed time to add.");
    return;
  }
  const owner = await getOwner(supabase);
  const { data: existing, error: existingError } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("call_id", call.id)
    .eq("starts_at", proposal.starts_at)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if ((existing ?? []).length > 0) {
    await ctx.reply(`${proposal.title} is already on your calendar.`);
    return;
  }
  const { error: insertError } = await supabase.from("calendar_events").insert({
    owner_id: owner.id,
    title: proposal.title,
    starts_at: proposal.starts_at,
    ends_at: proposal.ends_at,
    source: "sift",
    status: "planned",
    call_id: call.id,
  });
  if (insertError) throw new Error(insertError.message);
  await note(supabase, call.id, { command: "ADD", ...proposal });
  await ctx.reply(`Added ${proposal.title}. Reply UNDO to cancel.`);
}

async function handleUndo(
  supabase: SupabaseClient,
  ctx: CommandContext,
  call: CallRecord | null,
) {
  const owner = await getOwner(supabase);
  let query = supabase
    .from("calendar_events")
    .select("id, title")
    .eq("owner_id", owner.id)
    .eq("status", "planned")
    .order("starts_at", { ascending: false })
    .limit(1);
  if (call) query = query.eq("call_id", call.id);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    await ctx.reply("There's no planned event to cancel.");
    return;
  }
  const { error: deleteError } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", data.id);
  if (deleteError) throw new Error(deleteError.message);
  if (call) await note(supabase, call.id, { command: "UNDO", event_id: data.id });
  await ctx.reply(`Cancelled ${data.title ?? "that event"}.`);
}

function hourInZone(iso: string, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
  const hour = Number(formatted);
  return Number.isFinite(hour) ? hour : 0;
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return `${clock}${suffix}`;
}

export type WeeklyStats = {
  calls_handled: number;
  scams_blocked: number;
  meetings_booked: number;
  important_forwarded: number;
  minutes_saved: number;
  plan_vs_done: { planned: number; done: number; share: number };
  insight: string;
};

export async function collectWeeklyStats(
  supabase: SupabaseClient,
): Promise<WeeklyStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const owner = await getOwner(supabase);
  const timeZone = owner.timezone || "America/Los_Angeles";
  const { data: calls, error } = await supabase
    .from("calls")
    .select("classification, action, started_at")
    .gte("started_at", since);
  if (error) throw new Error(error.message);
  const rows = calls ?? [];
  const scams = rows.filter(
    (call) => call.classification === "scam" || call.action === "blocked",
  );
  const counts = new Array<number>(24).fill(0);
  for (const call of scams) {
    if (!call.started_at) continue;
    counts[hourInZone(call.started_at, timeZone)] += 1;
  }
  let bestStart = 0;
  let best = 0;
  for (let start = 0; start < 24; start += 1) {
    const total = (counts[start] ?? 0) + (counts[(start + 1) % 24] ?? 0);
    if (total > best) {
      best = total;
      bestStart = start;
    }
  }
  const insight =
    best > 0
      ? `Most scams called between ${formatHour(bestStart)} and ${formatHour((bestStart + 2) % 24)}.`
      : "No scam calls in the last 7 days.";

  const { data: events, error: eventError } = await supabase
    .from("calendar_events")
    .select("status")
    .gte("starts_at", since);
  if (eventError) throw new Error(eventError.message);
  const list = events ?? [];
  const done = list.filter((event) => event.status === "done").length;
  const share = list.length === 0 ? 0 : done / list.length;

  return {
    calls_handled: rows.length,
    scams_blocked: scams.length,
    meetings_booked: rows.filter((call) => call.action === "booked").length,
    important_forwarded: rows.filter((call) => call.action === "forwarded")
      .length,
    minutes_saved: rows.length * 4,
    plan_vs_done: { planned: list.length, done, share },
    insight,
  };
}

export function formatWeeklyStats(stats: WeeklyStats): string {
  const percent = Math.round(stats.plan_vs_done.share * 100);
  return [
    `This week: ${stats.calls_handled} calls handled, ${stats.scams_blocked} scams blocked, ${stats.meetings_booked} meetings booked, ${stats.important_forwarded} important calls forwarded.`,
    `About ${stats.minutes_saved} minutes saved (4 per screened call).`,
    `Plan vs done: ${stats.plan_vs_done.done} of ${stats.plan_vs_done.planned} events marked done (${percent}%).`,
    stats.insight,
  ].join(" ");
}

export type WeeklyReport = WeeklyStats & {
  paragraph: string;
  text: string;
};

export async function createWeeklyReport(
  supabase?: SupabaseClient,
): Promise<WeeklyReport> {
  const client = supabase ?? serviceClient();
  const stats = await collectWeeklyStats(client);
  let paragraph: string;
  try {
    paragraph = await writeWeeklyParagraph(stats);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "summary failed";
    paragraph = `A written summary is unavailable (${reason}). ${stats.insight}`;
  }
  return {
    ...stats,
    paragraph,
    text: `${paragraph} ${formatWeeklyStats(stats)}`,
  };
}

async function answerQuestion(
  supabase: SupabaseClient,
  question: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("calls")
    .select(
      "caller_name, caller_number, classification, risk_score, caller_intent, action, summary, started_at",
    )
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const calls = data ?? [];
  if (calls.length === 0) {
    return "I don't have any recent calls to answer from.";
  }
  const model = process.env.ANTHROPIC_MODEL?.trim();
  if (!model) throw new Error("ANTHROPIC_MODEL is required");
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model,
    max_tokens: 400,
    system:
      "You answer the owner's question about their recent calls. Use only the call records provided. If those records do not contain the answer, say you don't have that in the last 20 calls. Do not invent callers, times, or outcomes. Keep the reply under 3 sentences.",
    messages: [
      {
        role: "user",
        content: `Calls:\n${JSON.stringify(calls)}\n\nQuestion:\n${question}`,
      },
    ],
  });
  const block = message.content.find((part) => part.type === "text");
  if (!block || block.type !== "text" || !block.text.trim()) {
    throw new Error("Claude returned no answer");
  }
  return block.text.trim();
}

async function dispatch(text: string, ctx: CommandContext): Promise<CommandResult> {
  const supabase = db(ctx);
  const command = commandName(text);
  const call = command && command !== "REPORT" ? await latestCall(supabase) : null;

  if (command === "CALL") {
    await handleCall(supabase, ctx, call);
    return { command, ok: true };
  }
  if (command === "BLOCK" || command === "UNBLOCK") {
    await handleBlock(supabase, ctx, call, command === "BLOCK");
    return { command, ok: true };
  }
  if (command === "ADD") {
    await handleAdd(supabase, ctx, call);
    return { command, ok: true };
  }
  if (command === "UNDO") {
    await handleUndo(supabase, ctx, call);
    return { command, ok: true };
  }
  if (command === "REPORT") {
    const report = await createWeeklyReport(supabase);
    await ctx.reply(report.text);
    return { command, ok: true };
  }

  const question = text.trim();
  if (!question) {
    await ctx.reply(
      "Send CALL, BLOCK, UNBLOCK, ADD, UNDO, or REPORT. Or ask about a recent call.",
    );
    return { command: "help", ok: true };
  }
  await ctx.reply(await answerQuestion(supabase, question));
  return { command: "question", ok: true };
}

export async function parseCommand(
  text: string,
  ctx: CommandContext,
): Promise<CommandResult> {
  try {
    return await dispatch(text, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed";
    await ctx.reply(message);
    return { command: commandName(text) ?? "question", ok: false };
  }
}

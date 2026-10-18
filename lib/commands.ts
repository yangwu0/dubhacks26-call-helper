import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ownerForSender,
  serviceClient,
  type OwnerRow,
} from "@/app/api/tools/db";
import { writeWeeklyParagraph } from "@/lib/anthropic";

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
  important_forwarded: number;
  minutes_saved: number;
  insight: string;
};

export async function collectWeeklyStats(
  supabase: SupabaseClient,
  owner: OwnerRow,
): Promise<WeeklyStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeZone = owner.timezone || "America/Los_Angeles";
  const { data: calls, error } = await supabase
    .from("calls")
    .select("classification, action, started_at")
    .eq("owner_id", owner.id)
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

  return {
    calls_handled: rows.length,
    scams_blocked: scams.length,
    important_forwarded: rows.filter((call) => call.action === "forwarded")
      .length,
    minutes_saved: rows.length * 4,
    insight,
  };
}

export function formatWeeklyStats(stats: WeeklyStats): string {
  return [
    `This week: ${stats.calls_handled} calls handled, ${stats.scams_blocked} scams blocked, ${stats.important_forwarded} important calls forwarded.`,
    `About ${stats.minutes_saved} minutes saved (4 per screened call).`,
    stats.insight,
  ].join(" ");
}

export type WeeklyReport = WeeklyStats & {
  paragraph: string;
  text: string;
};

export async function createWeeklyReport(
  supabase?: SupabaseClient,
  owner?: OwnerRow,
): Promise<WeeklyReport> {
  const client = supabase ?? serviceClient();
  const who = owner ?? (await ownerForSender(client));
  const stats = await collectWeeklyStats(client, who);
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

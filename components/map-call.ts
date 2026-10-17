import type {
  BlockedNumber,
  CallRecord,
  OwnerProfile,
  RiskPoint,
  TranscriptLine,
} from "@/lib/mockCallData";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

type EventRow = {
  id?: number;
  call_id?: string;
  type?: string;
  payload?: unknown;
  created_at?: string;
};

function payloadRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function mapCall(row: Record<string, unknown>, events: EventRow[] = []): CallRecord {
  const id = text(row.id);
  const related = events.filter((event) => event.call_id === id);
  // Transcripts are not persisted; live demo uses mock data only.
  const transcript: TranscriptLine[] = [];

  const riskTimeline: RiskPoint[] = [];
  for (const event of related) {
    if (event.type !== "risk") continue;
    const payload = payloadRecord(event.payload);
    const score = typeof payload.score === "number" ? payload.score : null;
    if (score === null) continue;
    riskTimeline.push({
      at: text(event.created_at),
      score,
      reasons: stringList(payload.reasons),
    });
  }

  const riskScore = typeof row.risk_score === "number" ? row.risk_score : 0;
  const riskReasons = stringList(row.risk_reasons);
  if (riskTimeline.length === 0) {
    riskTimeline.push({
      at: text(row.ended_at) || text(row.started_at),
      score: riskScore,
      reasons: riskReasons,
    });
  }

  const status = row.status === "in_progress" ? "in_progress" : "completed";
  const classification =
    row.classification === "scam" ||
    row.classification === "legit_important" ||
    row.classification === "legit_routine"
      ? row.classification
      : "unknown";
  const action =
    row.action === "blocked" ||
    row.action === "forwarded" ||
    row.action === "message_taken" ||
    row.action === "booked"
      ? row.action
      : "none";

  return {
    id,
    callerNumber: text(row.caller_number),
    callerName: text(row.caller_name, "Unknown caller"),
    claimedTarget: text(row.claimed_target),
    targetMatch: typeof row.target_match === "boolean" ? row.target_match : null,
    status,
    classification,
    riskScore,
    riskReasons,
    callerIntent: text(row.caller_intent),
    action,
    summary: text(row.summary),
    transcript,
    riskTimeline,
    startedAt: text(row.started_at),
    endedAt: text(row.ended_at) || null,
  };
}

export function mapOwner(row: Record<string, unknown>): OwnerProfile {
  return {
    id: text(row.id),
    name: text(row.name, "Alex Kim"),
    aliases: stringList(row.aliases),
    phone: text(row.phone),
  };
}

export function mapBlocked(row: Record<string, unknown>): BlockedNumber {
  return {
    number: text(row.number),
    reason: text(row.reason),
    createdAt: text(row.created_at),
  };
}

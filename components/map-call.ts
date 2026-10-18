import type {
  FlaggedNumber,
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

function transcriptLine(
  id: string,
  role: unknown,
  body: unknown,
  at: unknown,
): TranscriptLine | null {
  const line = text(body).trim();
  if (!line) return null;
  return {
    id,
    role: role === "agent" ? "agent" : "caller",
    text: line,
    at: text(at),
  };
}

function transcriptFromEvents(events: EventRow[]): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const event of events) {
    if (event.type !== "transcript") continue;
    const payload = payloadRecord(event.payload);
    const line = transcriptLine(
      String(event.id ?? lines.length),
      payload.role,
      text(payload.text) || text(payload.message),
      event.created_at,
    );
    if (line) lines.push(line);
  }
  return lines;
}

function transcriptFromRow(value: unknown): TranscriptLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const line = transcriptLine(
      text(record.id, `stored-${index}`),
      record.role,
      text(record.message) || text(record.text),
      record.at,
    );
    return line ? [line] : [];
  });
}

export function mapCall(row: Record<string, unknown>, events: EventRow[] = []): CallRecord {
  const id = text(row.id);
  const related = events.filter((event) => event.call_id === id);
  const fromEvents = transcriptFromEvents(related);
  const fromRow = transcriptFromRow(row.transcript);
  const transcript = fromEvents.length >= fromRow.length ? fromEvents : fromRow;

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

  const endedAt = text(row.ended_at) || null;
  const status = endedAt ? "completed" : "in_progress";
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
    targetMatch: typeof row.target_match === "boolean" ? row.target_match : null,
    status,
    classification,
    riskScore,
    riskReasons,
    action,
    summary: text(row.summary),
    transcript,
    riskTimeline,
    startedAt: text(row.started_at),
    endedAt,
  };
}

export function mapOwner(row: Record<string, unknown>): OwnerProfile {
  return {
    id: text(row.id),
    name: text(row.name),
    aliases: stringList(row.aliases),
    phone: text(row.phone),
    photonNumber: text(row.photon_number),
    isDndOn: row.is_dnd_on === true || row.isDndOn === true,
  };
}

export function mapFlagged(row: Record<string, unknown>): FlaggedNumber {
  return {
    number: text(row.number),
    reason: text(row.reason),
    createdAt: text(row.created_at),
  };
}

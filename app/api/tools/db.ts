import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { openOwner, ownerSealPatch } from "@/lib/account-crypto";
import { verifySecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";

export type OwnerRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  phone: string;
  imessage_handle: string | null;
  timezone: string | null;
  sift_number: string | null;
};

export type CallRow = {
  id: string;
  owner_id: string | null;
  conversation_id: string | null;
  call_sid: string | null;
  caller_number: string | null;
  caller_name: string | null;
  claimed_target: string | null;
  target_match: boolean | null;
  status: string | null;
  classification: string | null;
  risk_score: number | null;
  risk_reasons: unknown;
  caller_intent: string | null;
  action: string | null;
  summary: string | null;
  transcript: unknown;
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function rejectIfUnauthorized(req: Request) {
  if (!verifySecret(req)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const OWNER_COLUMNS =
  "id, name, aliases, phone, imessage_handle, timezone, sift_number";

function samePhone(left: string, right: string): boolean {
  if (!left.trim() || !right.trim()) return false;
  return normalizePhone(left) === normalizePhone(right);
}

function matchesAddress(owner: OwnerRow, address: string): boolean {
  const raw = address.trim().toLowerCase();
  if (!raw) return false;
  if (owner.imessage_handle?.trim().toLowerCase() === raw) return true;
  return samePhone(owner.phone, address);
}

async function hydrateOwners(
  supabase: SupabaseClient,
  rows: OwnerRow[],
): Promise<OwnerRow[]> {
  await Promise.all(
    rows.map(async (row) => {
      const patch = ownerSealPatch(row);
      if (!patch) return;
      const { error } = await supabase.from("owners").update(patch).eq("id", row.id);
      if (error) throw new Error(error.message);
    }),
  );
  return rows.map((row) => openOwner(row));
}

async function listOwners(supabase: SupabaseClient): Promise<OwnerRow[]> {
  const { data, error } = await supabase
    .from("owners")
    .select(OWNER_COLUMNS)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return hydrateOwners(supabase, (data ?? []) as OwnerRow[]);
}

export async function getOwnerById(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<OwnerRow | null> {
  const { data, error } = await supabase
    .from("owners")
    .select(OWNER_COLUMNS)
    .eq("id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [owner] = await hydrateOwners(supabase, [data as OwnerRow]);
  return owner ?? null;
}

export async function getOwnerByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<OwnerRow | null> {
  const { data, error } = await supabase
    .from("owners")
    .select(OWNER_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [owner] = await hydrateOwners(supabase, [data as OwnerRow]);
  return owner ?? null;
}

// Used when a request has no signed-in user and no sender phone.
// One account is unambiguous. Several accounts are chosen by the phone
// saved on each row, or by the signed-in user.
export async function resolveOwner(supabase: SupabaseClient): Promise<OwnerRow> {
  const owners = await listOwners(supabase);
  if (owners.length === 0) throw new Error("no owner row");
  if (owners.length === 1) return owners[0];
  const withPhone = owners.filter((owner) => owner.phone.trim().startsWith("+"));
  if (withPhone.length === 1) return withPhone[0];
  throw new Error(
    "More than one Sift account. Match the phone saved on the account, or sign in.",
  );
}

export async function ownerForSender(
  supabase: SupabaseClient,
  address?: string,
): Promise<OwnerRow> {
  const raw = address?.trim() ?? "";
  if (!raw) return resolveOwner(supabase);
  const owners = await listOwners(supabase);
  const matches = owners.filter((owner) => matchesAddress(owner, raw));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error("More than one account matches that sender.");
  }
  throw new Error("No account uses that phone.");
}

export async function ownerForCall(
  supabase: SupabaseClient,
  call: { owner_id: string | null },
): Promise<OwnerRow | null> {
  if (!call.owner_id) return null;
  return getOwnerById(supabase, call.owner_id);
}

export async function ownerForCalledNumber(
  supabase: SupabaseClient,
  calledNumber: string,
): Promise<OwnerRow | null> {
  const number = normalizePhone(calledNumber);
  if (!number.startsWith("+")) return null;
  const { data, error } = await supabase
    .from("owners")
    .select(OWNER_COLUMNS)
    .eq("sift_number", number)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [owner] = await hydrateOwners(supabase, [data as OwnerRow]);
  return owner ?? null;
}

export async function ownerFromRequest(req: Request): Promise<OwnerRow | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  const anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return getOwnerByUserId(createServiceClient(), data.user.id);
}

export type TranscriptTurn = {
  role: "agent" | "caller";
  text: string;
  timeInCallSecs?: number;
};

function turnKey(role: string, text: string, timeInCallSecs?: number): string {
  return `${timeInCallSecs ?? ""}|${role}|${text}`;
}

export async function saveTranscriptTurns(
  supabase: SupabaseClient,
  callId: string,
  turns: TranscriptTurn[],
): Promise<number> {
  const meaningful = turns
    .map((turn) => ({ ...turn, text: turn.text.trim() }))
    .filter((turn) => turn.text.length > 0);
  if (meaningful.length === 0) return 0;

  const { data, error } = await supabase
    .from("call_events")
    .select("payload")
    .eq("call_id", callId)
    .eq("type", "transcript");
  if (error) throw new Error(error.message);

  const seen = new Set(
    (data ?? []).map((row) => {
      const payload =
        row.payload && typeof row.payload === "object"
          ? (row.payload as Record<string, unknown>)
          : {};
      const role = payload.role === "agent" ? "agent" : "caller";
      const text = typeof payload.text === "string" ? payload.text : "";
      const secs =
        typeof payload.time_in_call_secs === "number"
          ? payload.time_in_call_secs
          : undefined;
      return turnKey(role, text, secs);
    }),
  );
  const fresh = meaningful.filter(
    (turn) => !seen.has(turnKey(turn.role, turn.text, turn.timeInCallSecs)),
  );
  if (fresh.length === 0) return 0;

  const { error: insertError } = await supabase.from("call_events").insert(
    fresh.map((turn) => ({
      call_id: callId,
      type: "transcript",
      payload: {
        role: turn.role,
        text: turn.text,
        time_in_call_secs: turn.timeInCallSecs ?? null,
      },
    })),
  );
  if (insertError) throw new Error(insertError.message);
  return fresh.length;
}

export async function getOwner(supabase: SupabaseClient): Promise<OwnerRow> {
  return resolveOwner(supabase);
}

export async function getCallByConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<CallRow | null> {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRow | null) ?? null;
}

export async function getCallBySid(
  supabase: SupabaseClient,
  callSid: string,
): Promise<CallRow | null> {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("call_sid", callSid)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRow | null) ?? null;
}

export async function insertEvent(
  supabase: SupabaseClient,
  callId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from("call_events").insert({
    call_id: callId,
    type,
    payload,
  });
  if (error) throw new Error(error.message);
}

export async function isNumberBlocked(
  supabase: SupabaseClient,
  ownerId: string,
  number: string,
): Promise<boolean> {
  const normalized = normalizePhone(number);
  const { data, error } = await supabase
    .from("blocked_numbers")
    .select("number")
    .eq("owner_id", ownerId)
    .in("number", normalized === number ? [number] : [number, normalized])
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function isKnownContact(
  supabase: SupabaseClient,
  ownerId: string,
  number: string,
): Promise<boolean> {
  const normalized = normalizePhone(number);
  const { data, error } = await supabase
    .from("contacts")
    .select("number")
    .eq("owner_id", ownerId)
    .in("number", normalized === number ? [number] : [number, normalized])
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export function serviceClient() {
  return createServiceClient();
}

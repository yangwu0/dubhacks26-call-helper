import { NextResponse } from "next/server";
import { verifySecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnerRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  phone: string;
  imessage_handle: string | null;
  timezone: string | null;
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

export async function getOwner(supabase: SupabaseClient): Promise<OwnerRow> {
  const { data, error } = await supabase
    .from("owners")
    .select("id, name, aliases, phone, imessage_handle, timezone")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("no owner row");
  return data as OwnerRow;
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
  number: string,
): Promise<boolean> {
  const normalized = normalizePhone(number);
  const { data, error } = await supabase
    .from("blocked_numbers")
    .select("number")
    .in("number", normalized === number ? [number] : [number, normalized])
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function isKnownContact(
  supabase: SupabaseClient,
  number: string,
): Promise<boolean> {
  const normalized = normalizePhone(number);
  const { data, error } = await supabase
    .from("contacts")
    .select("number")
    .in("number", normalized === number ? [number] : [number, normalized])
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export function serviceClient() {
  return createServiceClient();
}

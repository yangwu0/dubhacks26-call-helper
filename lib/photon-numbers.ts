import type { SupabaseClient } from "@supabase/supabase-js";
import { openOwner } from "@/lib/account-crypto";
import { normalizePhone } from "@/app/api/tools/db";
import { projectAgentNumber } from "@/lib/photon-api";

// Photon 2.0 (Beta). Free and Pro share one iMessage line per project.
// Assigning a phone claims a seat on that line. It does not buy a new number.
// https://photon.codes/docs/beta/get-started/imessage
// https://photon.codes/docs/beta/plans-and-billing

const API = "https://api.photon.codes/v1";

export type LineStatus = "ready" | "pending" | "failed" | "unconfigured";

export type OwnerLine = {
  status: LineStatus;
  number: string;
  message: string;
};

type PhotonConfig = { projectId: string; apiKey: string };

type OwnerLineRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  phone: string;
  imessage_handle: string | null;
  sift_number: string | null;
};

const READY_MESSAGE =
  "Text this number from your phone once. Sift can reply after that. Everyone uses this shared Photon line.";
const VOICE_MESSAGE =
  "Call this number, or text it BLOCK or CALL. Photon sends calls to ElevenLabs. Open the number there and choose your Sift agent.";

function config(): PhotonConfig | null {
  const projectId = process.env.PHOTON_PROJECT_ID?.trim() ?? "";
  const apiKey = process.env.PHOTON_API_KEY?.trim() ?? "";
  if (!projectId.startsWith("pho_prj_") || !apiKey) return null;
  return { projectId, apiKey };
}

function problemMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string" && record.detail.trim()) return record.detail;
  if (typeof record.title === "string" && record.title.trim()) return record.title;
  return fallback;
}

function phoneFromDetail(value: unknown, depth = 0): string | null {
  if (depth > 4 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = phoneFromDetail(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["phoneNumber", "phone_number", "e164", "number", "msisdn"]) {
    const item = record[key];
    if (typeof item === "string" && item.includes("+")) return normalizePhone(item);
  }
  for (const nested of Object.values(record)) {
    const found = phoneFromDetail(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

async function photon(
  cfg: PhotonConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${cfg.apiKey}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { detail: text.slice(0, 180) };
    }
  }
  return { ok: response.ok, status: response.status, body };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function assignedNumber(body: unknown): string | null {
  const record = asRecord(body);
  for (const key of ["assignedPhoneNumber", "assigned_phone_number"]) {
    const value = record?.[key];
    if (typeof value === "string" && value.includes("+")) return normalizePhone(value);
  }
  return phoneFromDetail(body);
}

function senderHandle(row: OwnerLineRow): string {
  const opened = openOwner(row);
  const phone = opened.phone.trim();
  if (phone.startsWith("+")) return normalizePhone(phone);
  const handle = opened.imessage_handle?.trim() ?? "";
  if (handle.startsWith("+") || handle.includes("@")) return handle;
  return "";
}

async function remember(
  supabase: SupabaseClient,
  ownerId: string,
  patch: Record<string, string | null>,
) {
  const { error } = await supabase.from("owners").update(patch).eq("id", ownerId);
  if (error) throw new Error(error.message);
}

export async function ensureOwnerLine(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<OwnerLine> {
  const { data, error } = await supabase
    .from("owners")
    .select(
      "id, name, aliases, phone, imessage_handle, sift_number",
    )
    .eq("id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const owner = data as OwnerLineRow | null;
  if (!owner) return { status: "failed", number: "", message: "This account has no profile." };
  const voiceNumber = await projectAgentNumber();
  if (voiceNumber) {
    const { data: taken, error: takenError } = await supabase
      .from("owners")
      .select("id")
      .eq("sift_number", voiceNumber)
      .neq("id", owner.id)
      .limit(1);
    if (takenError) throw new Error(takenError.message);
    if (!taken?.length) {
      if (owner.sift_number !== voiceNumber) {
        await remember(supabase, owner.id, {
          sift_number: voiceNumber,
          photon_line_error: null,
        });
      }
      return { status: "ready", number: voiceNumber, message: VOICE_MESSAGE };
    }
  }
  if (owner.sift_number) {
    return {
      status: "ready",
      number: owner.sift_number,
      message: READY_MESSAGE,
    };
  }

  const cfg = config();
  if (!cfg) {
    return {
      status: "unconfigured",
      number: "",
      message: "The shared Photon line shows up here once the server is connected.",
    };
  }

  const handle = senderHandle(owner);
  if (!handle) {
    return {
      status: "unconfigured",
      number: "",
      message: "Add your phone and Sift connects it to the shared line.",
    };
  }

  const assigned = await photon(
    cfg,
    `/projects/${cfg.projectId}/platforms/imessage/assignments`,
    {
      method: "POST",
      headers: { "Idempotency-Key": `sift-assign-${owner.id}-${handle}` },
      body: JSON.stringify({ handle }),
    },
  );
  const number = assignedNumber(assigned.body);
  if (!assigned.ok || !number) {
    const message = problemMessage(assigned.body, "Photon could not connect this phone.");
    await remember(supabase, owner.id, { photon_line_error: message });
    return { status: "failed", number: "", message };
  }
  await remember(supabase, owner.id, {
    sift_number: number,
    photon_line_error: null,
  });
  return { status: "ready", number, message: READY_MESSAGE };
}

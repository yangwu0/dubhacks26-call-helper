import type { SupabaseClient } from "@supabase/supabase-js";
import { projectAgentNumber } from "@/lib/photon-api";

// Photon already owns the calling number and routes it to ElevenLabs.
// This only remembers that number on the account so the dashboard can show it.
// https://photon.codes/docs/beta/cookbooks/voice/elevenlabs

export type LineStatus = "ready" | "pending" | "failed" | "unconfigured";

export type OwnerLine = {
  status: LineStatus;
  number: string;
  message: string;
};

type OwnerLineRow = {
  id: string;
  photon_number: string | null;
};

const VOICE_MESSAGE =
  "Everyone calls this number. Sift screens the caller and logs the call on your dashboard.";

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
    .select("id, photon_number")
    .eq("id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const owner = data as OwnerLineRow | null;
  if (!owner) return { status: "failed", number: "", message: "This account has no profile." };

  const voiceNumber = await projectAgentNumber();
  if (!voiceNumber) {
    return {
      status: "unconfigured",
      number: owner.photon_number ?? "",
      message: "Photon has no calling number yet.",
    };
  }

  if (owner.photon_number !== voiceNumber) {
    await remember(supabase, owner.id, {
      photon_number: voiceNumber,
    });
  }
  return { status: "ready", number: voiceNumber, message: VOICE_MESSAGE };
}

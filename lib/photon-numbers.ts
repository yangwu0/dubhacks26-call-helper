import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_PHOTON_NUMBER } from "@/lib/owner-phone";

// Demo: use the hardcoded Photon agent number instead of looking it up live.
// https://photon.codes/docs/beta/cookbooks/voice/elevenlabs

export type LineStatus = "ready" | "pending" | "failed" | "unconfigured";

export type OwnerLine = {
  status: LineStatus;
  number: string;
  message: string;
};

const VOICE_MESSAGE =
  "Everyone calls this number. Sift screens the caller and logs the call on your dashboard.";

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
  if (!data) return { status: "failed", number: "", message: "This account has no profile." };

  if (data.photon_number !== DEMO_PHOTON_NUMBER) {
    const { error: updateError } = await supabase
      .from("owners")
      .update({ photon_number: DEMO_PHOTON_NUMBER })
      .eq("id", ownerId);
    if (updateError) throw new Error(updateError.message);
  }

  return {
    status: "ready",
    number: DEMO_PHOTON_NUMBER,
    message: VOICE_MESSAGE,
  };
}

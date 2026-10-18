import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  json,
  ownerFromRequest,
  saveTranscriptTurns,
  serviceClient,
  type TranscriptTurn,
} from "@/app/api/tools/db";

// Pulls the in-progress ElevenLabs transcript onto the call so the dashboard
// can show it before the post-call webhook arrives.
export async function POST(req: Request) {
  const owner = await ownerFromRequest(req);
  if (!owner) return json({ error: "unauthorized" }, 401);

  const supabase = serviceClient();
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, conversation_id")
    .eq("owner_id", owner.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(5);
  if (error) return json({ error: error.message }, 500);
  const active = (calls ?? []).filter((call) => call.conversation_id);
  if (active.length === 0) return json({ synced: 0 });

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("pho_")) return json({ synced: 0 });

  try {
    const client = new ElevenLabsClient({ apiKey });
    let synced = 0;
    for (const call of active) {
      const conversation = await client.conversationalAi.conversations.get(
        call.conversation_id as string,
      );
      const turns: TranscriptTurn[] = (conversation.transcript ?? []).flatMap((turn) => {
        const text = turn.message?.trim() ?? "";
        if (!text) return [];
        return [
          {
            role: turn.role === "agent" ? "agent" : "caller",
            text,
            timeInCallSecs: turn.timeInCallSecs,
          } satisfies TranscriptTurn,
        ];
      });
      synced += await saveTranscriptTurns(supabase, call.id, turns);
    }
    return json({ synced });
  } catch (syncError) {
    console.error(
      "live sync",
      syncError instanceof Error ? syncError.message : syncError,
    );
    return json({ synced: 0 });
  }
}

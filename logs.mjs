import { Photon } from "@photon-ai/api";

const env = process.env;
for (const k of [
  "PHOTON_API_KEY",
  "PHOTON_PROJECT_ID",
  "PHOTON_VOICE_PROFILE_ID",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_AGENT_ID",
]) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
}

// --- Photon: read the saved inbound SIP destination ---
const photon = new Photon({
  headers: { Authorization: `Bearer ${env.PHOTON_API_KEY}` },
});
try {
  const profile = await photon.projects.platforms.getVoiceProfile({
    path: { id: env.PHOTON_PROJECT_ID, profileId: env.PHOTON_VOICE_PROFILE_ID },
  });
  console.log(
    "Photon inbound destination:",
    profile.configuration.inbound?.destinationUri ?? "inbound not enabled",
  );
} catch (e) {
  console.error("Photon call failed:", e.message);
}

// --- ElevenLabs: print the latest conversation transcript ---
const el = (path) =>
  fetch(`https://api.elevenlabs.io${path}`, {
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  });

try {
  const list = await el(
    `/v1/convai/conversations?agent_id=${env.ELEVENLABS_AGENT_ID}&page_size=1`,
  );
  const id = list.conversations?.[0]?.conversation_id;
  if (!id) {
    console.log("No conversations found");
    process.exit(0);
  }
  const convo = await el(`/v1/convai/conversations/${id}`);
  console.log(`\nConversation ${id} (status: ${convo.status})`);
  console.log("Metadata:", JSON.stringify(convo.metadata, null, 2));
  for (const t of convo.transcript ?? []) {
    console.log(`${t.role}: ${t.message ?? ""}`);
    if (t.tool_calls?.length)
      console.log(
        "  tool calls:",
        JSON.stringify(t.tool_calls.map((c) => c.tool_name)),
      );
  }
} catch (e) {
  console.error("ElevenLabs call failed:", e.message);
}

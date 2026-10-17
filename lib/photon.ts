import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  Emoji,
  Spectrum,
  poll,
  voice,
  type Message,
  type Space,
} from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { serviceClient } from "@/app/api/tools/db";
import { parseCommand } from "@/lib/commands";

// Stable Spectrum (spectrum-ts 12.11.0). Project ids that start with pho_prj_
// belong to Photon 2.0 and do not authenticate this SDK.
// https://photon.codes/docs/spectrum-ts/getting-started
// https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing
// https://photon.codes/docs/spectrum-ts/webhooks
// https://photon.codes/docs/spectrum-ts/content/polls
// https://photon.codes/docs/spectrum-ts/content/voice

const seenIds = new Set<string>();
const pollTargets = new Map<string, string>();

function credential(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || process.env[fallback]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

let appPromise: ReturnType<typeof Spectrum> | null = null;

export function getSpectrumApp() {
  if (!appPromise) {
    const projectId = credential("PHOTON_PROJECT_ID", "SPECTRUM_PROJECT_ID");
    const projectSecret = credential(
      "PHOTON_PROJECT_SECRET",
      "SPECTRUM_PROJECT_SECRET",
    );
    const webhookSecret = process.env.SPECTRUM_WEBHOOK_SECRET?.trim();
    appPromise = Spectrum({
      projectId,
      projectSecret,
      providers: [imessage.config()],
      options: { flattenGroups: true },
      ...(webhookSecret ? { webhookSecret } : {}),
    }).catch((error: unknown) => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}

async function ownerSpace(to: string) {
  const app = await getSpectrumApp();
  const im = imessage(app);
  const user = await im.user(to);
  return im.space.create(user);
}

export async function sendIMessage(to: string, body: string): Promise<void> {
  const space = await ownerSpace(to);
  await space.send(body);
}

export function numberForPoll(pollMessageGuid: string | undefined): string | undefined {
  if (!pollMessageGuid) return undefined;
  return pollTargets.get(pollMessageGuid);
}

export async function sendAlertWithPoll(
  to: string,
  body: string,
  callerNumber?: string | null,
): Promise<void> {
  const space = await ownerSpace(to);
  await space.send(body);
  const sent = await space.send(poll("Block this number?", "Block", "Allow"));
  if (sent && callerNumber) pollTargets.set(sent.id, callerNumber);
  await maybeVoiceNote(space, body);
}

async function maybeVoiceNote(space: Space, text: string): Promise<void> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!voiceId || !apiKey) return;
  try {
    const client = new ElevenLabsClient({ apiKey });
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      outputFormat: "mp3_22050_32",
    });
    const bytes = Buffer.from(await new Response(audio).arrayBuffer());
    await space.send(
      voice(bytes, { name: "sift-alert.mp3", mimeType: "audio/mpeg" }),
    );
  } catch (error) {
    console.error(
      "voice note",
      error instanceof Error ? error.message : error,
    );
  }
}

function remember(id: string): boolean {
  if (seenIds.has(id)) return false;
  seenIds.add(id);
  if (seenIds.size > 500) {
    const oldest = seenIds.values().next().value;
    if (oldest) seenIds.delete(oldest);
  }
  return true;
}

async function logMessage(
  direction: "in" | "out",
  address: string,
  body: string,
) {
  const supabase = serviceClient();
  const { error } = await supabase.from("messages").insert({
    direction,
    channel: "imessage",
    address,
    body,
  });
  if (error) console.error("messages insert", error.message);
}

export async function handleInboundMessage(
  space: Space,
  message: Message,
): Promise<void> {
  if (message.direction !== "inbound") return;
  if (!remember(message.id)) return;

  const address = message.sender?.id ?? "unknown";
  const content = message.content;
  const reply = async (body: string) => {
    await space.send(body);
    await logMessage("out", address, body);
  };

  if (content.type === "text") {
    await logMessage("in", address, content.text);
    const result = await parseCommand(content.text, { reply });
    if (result.ok) await message.react(Emoji.like);
    return;
  }

  if (content.type === "poll_option") {
    if (!content.selected) return;
    const choice = content.option.title.trim().toLowerCase();
    await logMessage("in", address, `poll:${choice}`);
    if (choice === "block") {
      await parseCommand("BLOCK", {
        reply,
        numberOverride: numberForPoll(content.pollMessageGuid),
      });
      return;
    }
    if (choice === "allow") {
      await reply("Left them unblocked.");
    }
    return;
  }

  if (content.type === "attachment") {
    await logMessage(
      "in",
      address,
      `attachment:${content.name}:${content.mimeType}`,
    );
    await reply(
      "I got an attachment. Text me what it says if you want a verdict.",
    );
  }
}

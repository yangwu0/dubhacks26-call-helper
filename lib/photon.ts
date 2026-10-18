import { Emoji, Spectrum, type Message, type Space } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { serviceClient } from "@/app/api/tools/db";
import {
  formatScanReply,
  isForwardedText,
  scanContent,
  type ScanImageType,
} from "@/lib/anthropic";
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

export async function sendIMessage(to: string, body: string): Promise<void> {
  const { sendPhotonText } = await import("./photon-api");
  await sendPhotonText(to, body);
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
  const { sendPhotonPoll, sendPhotonText } = await import("./photon-api");
  await sendPhotonText(to, body);
  try {
    const sent = await sendPhotonPoll(to, "Block this number?");
    if (sent && callerNumber) pollTargets.set(sent, callerNumber);
  } catch (error) {
    console.error("poll", error instanceof Error ? error.message : error);
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

type PhotonCommand = {
  address: string;
  text: string;
};

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function photonCommand(body: unknown): PhotonCommand | null {
  const event = record(body);
  if (!event || event.type !== "message.received") return null;
  const message = record(record(event.data)?.object);
  if (!message || (message.status && message.status !== "received")) return null;
  const sender = record(message.sentBy);
  const handle = typeof sender?.handle === "string" ? sender.handle : "";
  if (!sender || sender.kind === "agent" || !handle) return null;
  const id = typeof message.id === "string" ? message.id : "";
  if (id && !remember(id)) return null;
  const content = record(message.content);
  if (!content) return null;
  if (content.type === "text" && typeof content.text === "string") {
    return { address: handle, text: content.text };
  }
  if (content.type !== "poll.vote" || !Array.isArray(content.selectedOptions)) return null;
  const blocked = content.selectedOptions.some((option) => {
    const row = record(option);
    if (!row) return false;
    const label = typeof row.text === "string" ? row.text.trim().toLowerCase() : "";
    return row.id === "block" || label === "block";
  });
  return { address: handle, text: blocked ? "BLOCK" : "ALLOW" };
}

// Photon 2.0 message.received. The sender handle is the owner's phone.
// https://api.photon.codes/v1/projects/{id}/webhooks/event-types/message.received/schema
export async function handlePhotonDelivery(body: unknown): Promise<void> {
  const command = photonCommand(body);
  if (!command) return;
  const reply = async (text: string) => {
    const { sendPhotonText } = await import("./photon-api");
    await sendPhotonText(command.address, text);
    await logMessage("out", command.address, text);
  };
  await logMessage("in", command.address, command.text);
  if (command.text === "ALLOW") {
    await reply("Left them unblocked.");
    return;
  }
  await parseCommand(command.text, { reply, address: command.address });
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
    if (isForwardedText(content.text)) {
      await reply(await scanOrExplain(() => scanContent({ text: content.text })));
      return;
    }
    const result = await parseCommand(content.text, { reply, address });
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
        address,
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
      await scanAttachment(content.mimeType, content.name, () => content.read()),
    );
  }
}

async function scanOrExplain(
  run: () => ReturnType<typeof scanContent>,
): Promise<string> {
  try {
    return formatScanReply(await run());
  } catch (error) {
    return error instanceof Error ? error.message : "Scan failed";
  }
}

const SCAN_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

async function scanAttachment(
  mimeType: string,
  name: string,
  read: () => Promise<Buffer>,
): Promise<string> {
  const bytes = await read();
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return scanOrExplain(() => scanContent({ text: bytes.toString("utf8") }));
  }
  if ((SCAN_IMAGES as readonly string[]).includes(mimeType)) {
    return scanOrExplain(() =>
      scanContent({
        imageBase64: bytes.toString("base64"),
        mediaType: mimeType as ScanImageType,
      }),
    );
  }
  return `I can't scan ${name || mimeType}. Paste the text instead.`;
}

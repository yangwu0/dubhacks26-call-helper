import { serviceClient } from "@/app/api/tools/db";
import { formatScanReply, isForwardedText, scanContent } from "@/lib/anthropic";
import { parseCommand } from "@/lib/commands";
import { sendPhotonPoll, sendPhotonText } from "@/lib/photon-api";

// Photon 2.0 delivers texts. This file turns those texts into Sift commands.
// https://photon.codes/docs/beta/api-reference

const seenIds = new Set<string>();

function remember(id: string): boolean {
  if (seenIds.has(id)) return false;
  seenIds.add(id);
  if (seenIds.size > 500) {
    const oldest = seenIds.values().next().value;
    if (oldest) seenIds.delete(oldest);
  }
  return true;
}

async function logMessage(direction: "in" | "out", address: string, body: string) {
  const supabase = serviceClient();
  const { error } = await supabase.from("messages").insert({
    direction,
    channel: "imessage",
    address,
    body,
  });
  if (error) console.error("messages insert", error.message);
}

export async function sendAlertWithPoll(
  to: string,
  body: string,
  callerNumber?: string | null,
): Promise<void> {
  await sendPhotonText(to, body);
  void callerNumber;
  try {
    await sendPhotonPoll(to, "Block this number?");
  } catch (error) {
    console.error("poll", error instanceof Error ? error.message : error);
  }
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

async function scanOrExplain(text: string): Promise<string> {
  try {
    return formatScanReply(await scanContent({ text }));
  } catch (error) {
    return error instanceof Error ? error.message : "Scan failed";
  }
}

// Photon 2.0 message.received. The sender handle is the owner's phone.
// https://api.photon.codes/v1/projects/{id}/webhooks/event-types/message.received/schema
export async function handlePhotonDelivery(body: unknown): Promise<void> {
  const command = photonCommand(body);
  if (!command) return;
  const reply = async (text: string) => {
    await sendPhotonText(command.address, text);
    await logMessage("out", command.address, text);
  };
  await logMessage("in", command.address, command.text);
  if (command.text === "ALLOW") {
    await reply("Left them unblocked.");
    return;
  }
  if (isForwardedText(command.text)) {
    await reply(await scanOrExplain(command.text));
    return;
  }
  await parseCommand(command.text, { reply, address: command.address });
}

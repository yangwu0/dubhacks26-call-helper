import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { normalizePhone } from "@/app/api/tools/db";

// Photon 2.0. Project ids that start with pho_prj_ authenticate with
// PHOTON_API_KEY. https://photon.codes/docs/beta/api-reference/messages/send-a-message
// https://photon.codes/docs/beta/api-reference/spaces/create-or-get-a-space

const API = "https://api.photon.codes/v1";

type PhotonConfig = { projectId: string; apiKey: string };

type PhotonUser = {
  id: string;
  kind: string;
  platform: string;
  handle: string;
};

function config(): PhotonConfig {
  const projectId = process.env.PHOTON_PROJECT_ID?.trim() ?? "";
  const apiKey = process.env.PHOTON_API_KEY?.trim() ?? "";
  if (!projectId.startsWith("pho_prj_") || !apiKey) {
    throw new Error("PHOTON_PROJECT_ID and PHOTON_API_KEY are required");
  }
  return { projectId, apiKey };
}

function problem(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string" && record.detail.trim()) return record.detail;
  if (typeof record.title === "string" && record.title.trim()) return record.title;
  return fallback;
}

async function photon(
  cfg: PhotonConfig,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
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
  if (!response.ok) throw new Error(problem(body, "Photon request failed"));
  return body;
}

function asUser(value: unknown): PhotonUser | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const row =
    record.root && typeof record.root === "object"
      ? (record.root as Record<string, unknown>)
      : record;
  if (typeof row.id !== "string" || typeof row.handle !== "string") return null;
  return {
    id: row.id,
    kind: typeof row.kind === "string" ? row.kind : "",
    platform: typeof row.platform === "string" ? row.platform : "",
    handle: row.handle,
  };
}

async function listUsers(cfg: PhotonConfig): Promise<PhotonUser[]> {
  const body = await photon(cfg, `/projects/${cfg.projectId}/users?pageSize=100`);
  const items =
    body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : [];
  return items.flatMap((item) => {
    const user = asUser(item);
    return user ? [user] : [];
  });
}

export async function projectAgentNumber(): Promise<string | null> {
  try {
    const users = await listUsers(config());
    const agent = users.find((user) => user.kind === "agent" && user.handle.startsWith("+"));
    return agent?.handle ?? null;
  } catch (error) {
    console.error("photon agent number", error instanceof Error ? error.message : error);
    return null;
  }
}

function address(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed;
  return normalizePhone(trimmed);
}

async function userFor(
  cfg: PhotonConfig,
  platform: string,
  handle: string,
): Promise<PhotonUser> {
  const body = await photon(cfg, `/projects/${cfg.projectId}/users`, {
    method: "POST",
    headers: { "Idempotency-Key": `sift-user-${platform}-${handle}` },
    body: JSON.stringify({ platform, handle }),
  });
  const user = asUser(body);
  if (!user) throw new Error("Photon did not return a user for that phone");
  return user;
}

async function spaceId(
  cfg: PhotonConfig,
  platform: string,
  agentId: string,
  humanId: string,
): Promise<string> {
  const body = await photon(cfg, `/projects/${cfg.projectId}/spaces`, {
    method: "POST",
    headers: { "Idempotency-Key": `sift-space-${agentId}-${humanId}` },
    body: JSON.stringify({ platform, participantIds: [agentId, humanId] }),
  });
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (typeof record.id !== "string") throw new Error("Photon did not return a conversation");
  return record.id;
}

async function sendContent(
  cfg: PhotonConfig,
  space: string,
  senderId: string,
  content: Record<string, unknown>,
): Promise<string | null> {
  const body = await photon(cfg, `/projects/${cfg.projectId}/messages`, {
    method: "POST",
    headers: { "Idempotency-Key": `sift-msg-${randomUUID()}` },
    body: JSON.stringify({ spaceId: space, senderId, content }),
  });
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return typeof record.id === "string" ? record.id : null;
}

async function conversation(to: string): Promise<{
  cfg: PhotonConfig;
  space: string;
  senderId: string;
}> {
  const cfg = config();
  const handle = address(to);
  const users = await listUsers(cfg);
  const existing = users.find((user) => user.handle === handle && user.kind === "human");
  const agent =
    users.find((user) => user.kind === "agent" && user.platform === existing?.platform) ??
    users.find((user) => user.kind === "agent");
  if (!agent) throw new Error("This Photon project has no agent number");
  const human = existing ?? (await userFor(cfg, agent.platform, handle));
  return {
    cfg,
    senderId: agent.id,
    space: await spaceId(cfg, agent.platform, agent.id, human.id),
  };
}

export async function sendPhotonText(to: string, body: string): Promise<void> {
  const thread = await conversation(to);
  await sendContent(thread.cfg, thread.space, thread.senderId, {
    type: "text",
    format: "plain",
    text: body,
  });
}

// Photon 2.0 signs deliveries with Standard Webhooks.
// https://photon.codes/docs/beta/api-reference/webhooks/create-webhook-destination
export function verifyPhotonWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.PHOTON_WEBHOOK_SECRET?.trim() ?? "";
  const id = headers.get("webhook-id") ?? "";
  const timestamp = headers.get("webhook-timestamp") ?? "";
  const signature = headers.get("webhook-signature") ?? "";
  if (!secret || !id || !timestamp || !signature) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 300) return false;
  const material = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(material, "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBytes = Buffer.from(expected);
  return signature.split(" ").some((part) => {
    const candidate = part.startsWith("v1,") ? part.slice(3) : "";
    const got = Buffer.from(candidate);
    return got.length === expectedBytes.length && timingSafeEqual(got, expectedBytes);
  });
}

export async function sendPhotonPoll(to: string, question: string): Promise<string | null> {
  const thread = await conversation(to);
  return sendContent(thread.cfg, thread.space, thread.senderId, {
    type: "poll",
    question,
    selectionMode: "single",
    options: [
      { id: "block", text: "Block" },
      { id: "allow", text: "Allow" },
    ],
  });
}

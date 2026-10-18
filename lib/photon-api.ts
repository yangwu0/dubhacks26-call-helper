// Photon project lookup for the shared calling number.
// Messaging send/receive is disabled; Photon is used for SIP voice only.
// https://photon.codes/docs/beta/cookbooks/voice/elevenlabs

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

/** Shared Photon agent number people dial (voice over SIP). */
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

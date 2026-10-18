import { after } from "next/server";
import { verifySecret } from "@/lib/auth";
import { parseCommand } from "@/lib/commands";
import { verifyPhotonWebhook } from "@/lib/photon-api";
import { handlePhotonDelivery } from "@/lib/photon";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

// Photon 2.0 posts message.received here with a Standard Webhooks signature.
// Direct JSON with x-sift-secret is for local command checks.
// https://photon.codes/docs/beta/api-reference
export async function POST(req: Request) {
  if (req.headers.get("webhook-signature")) {
    const raw = await req.text();
    if (!verifyPhotonWebhook(raw, req.headers)) {
      return json({ error: "unauthorized" }, 401);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    after(async () => {
      try {
        await handlePhotonDelivery(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : "photon inbound failed";
        console.error("photon inbound", message);
      }
    });
    return json({ ok: true });
  }

  const providedSecret = req.headers.get("x-sift-secret");
  if (providedSecret !== null && !verifySecret(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  const signature = req.headers.get("x-spectrum-signature");
  if (!signature) {
    if (!verifySecret(req)) return json({ error: "unauthorized" }, 401);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const text =
      body && typeof body === "object" && "text" in body && typeof body.text === "string"
        ? body.text
        : "";
    const replies: string[] = [];
    const result = await parseCommand(text, {
      reply: async (message) => {
        replies.push(message);
      },
      numberOverride:
        body &&
        typeof body === "object" &&
        "number" in body &&
        typeof body.number === "string"
          ? body.number
          : undefined,
      address:
        body &&
        typeof body === "object" &&
        "address" in body &&
        typeof body.address === "string"
          ? body.address
          : undefined,
    });
    return json({ ...result, replies });
  }

  return json({ error: "unauthorized" }, 401);
}

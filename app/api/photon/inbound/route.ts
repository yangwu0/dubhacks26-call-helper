import { after } from "next/server";
import { verifySecret } from "@/lib/auth";
import { parseCommand } from "@/lib/commands";
import { getSpectrumApp, handleInboundMessage } from "@/lib/photon";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

// Direct JSON is for local command checks. Photon deliveries use the
// Spectrum HMAC (`X-Spectrum-Signature`) inside app.webhook().
// https://photon.codes/docs/spectrum-ts/webhooks
export async function POST(req: Request) {
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
    });
    return json({ ...result, replies });
  }

  try {
    const app = await getSpectrumApp();
    const jobs: Promise<void>[] = [];
    const response = await app.webhook(req, (space, message) => {
      const job = handleInboundMessage(space, message);
      jobs.push(job);
      return job;
    });
    after(async () => {
      await Promise.all(jobs);
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "photon inbound failed";
    console.error("photon inbound", message);
    return json({ error: message }, 500);
  }
}

import { ensureOwnerLine } from "@/lib/photon-numbers";
import { json, ownerFromRequest, serviceClient } from "@/app/api/tools/db";

export async function POST(req: Request) {
  try {
    const owner = await ownerFromRequest(req);
    if (!owner) return json({ error: "Sign in again." }, 401);
    const line = await ensureOwnerLine(serviceClient(), owner.id);
    return json(line);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assign a number.";
    console.error("line", message);
    return json({ status: "failed", number: "", message }, 500);
  }
}

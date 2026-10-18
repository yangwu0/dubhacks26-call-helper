import { sealOwner } from "@/lib/account-crypto";
import {
  asStringArray,
  json,
  normalizePhone,
  ownerFromRequest,
  serviceClient,
} from "@/app/api/tools/db";

function accountPayload(owner: {
  id: string;
  name: string;
  aliases: string[] | null;
  phone: string;
  sift_number?: string | null;
}) {
  return {
    id: owner.id,
    name: owner.name,
    aliases: owner.aliases ?? [],
    phone: owner.phone,
    siftNumber: owner.sift_number ?? "",
    encrypted: true,
  };
}

export async function GET(req: Request) {
  try {
    const owner = await ownerFromRequest(req);
    if (!owner) return json({ error: "Sign in again." }, 401);
    return json(accountPayload(owner));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the account.";
    return json({ error: message }, 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const owner = await ownerFromRequest(req);
    if (!owner) return json({ error: "Sign in again." }, 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Send the profile as JSON." }, 400);
    }
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const phone = typeof record.phone === "string" ? record.phone.trim() : "";
    const aliases = asStringArray(record.aliases)
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0);
    if (!name || name.length > 120) {
      return json({ error: "Enter a name." }, 400);
    }
    if (phone.length > 32 || aliases.length > 20 || aliases.some((alias) => alias.length > 80)) {
      return json({ error: "That profile is too long." }, 400);
    }
    const nextPhone = phone ? normalizePhone(phone) : "";
    if (nextPhone && !nextPhone.startsWith("+")) {
      return json({ error: "Enter your phone with the country code, like +12065550100." }, 400);
    }
    const previousPhone = owner.phone.trim();
    const handle = nextPhone || owner.imessage_handle;

    const sealed = sealOwner({
      id: owner.id,
      name,
      aliases,
      phone: nextPhone,
      imessage_handle: handle,
    });
    const saved = await serviceClient()
      .from("owners")
      .update({
        name: sealed.name,
        aliases: sealed.aliases,
        phone: sealed.phone,
        imessage_handle: sealed.imessage_handle,
      })
      .eq("id", owner.id)
      .select("id")
      .maybeSingle();
    if (saved.error) return json({ error: saved.error.message }, 500);
    if (!saved.data) return json({ error: "Could not save the profile." }, 404);

    const message =
      nextPhone && nextPhone !== previousPhone
        ? "Phone saved. Text Sift's number from this phone once it shows up."
        : "Saved.";

    return json({
      ok: true,
      message,
      ...accountPayload({
        id: owner.id,
        name,
        aliases,
        phone: nextPhone,
        sift_number: owner.sift_number,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the account.";
    return json({ error: message }, 500);
  }
}

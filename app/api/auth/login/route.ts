import { createClient } from "@supabase/supabase-js";
import { sealOwner } from "@/lib/account-crypto";
import { getOwnerByUserId, normalizePhone } from "@/app/api/tools/db";
import { DEMO_OWNER_PHONE, DEMO_PHOTON_NUMBER } from "@/lib/owner-phone";
import { createServiceClient } from "@/lib/supabase";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function displayName(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return words || "Owner";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send an email and password." }, 400);
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const password = typeof record.password === "string" ? record.password : "";
  const phoneRaw = typeof record.phone === "string" ? record.phone.trim() : "";
  const ownerPhone = phoneRaw ? normalizePhone(phoneRaw) : "";
  if (ownerPhone && !ownerPhone.startsWith("+")) {
    return json({ error: "Enter your phone with the country code, like +12065550100." }, 400);
  }
  if (!email.includes("@") || password.length < 6) {
    return json(
      { error: "Use an email and a password of at least 6 characters." },
      400,
    );
  }

  const anon = publicClient();
  if (!anon) return json({ error: "Supabase is not configured." }, 500);

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase is not configured.";
    return json({ error: message }, 500);
  }

  const probe = await admin.from("owners").select("id").limit(1);
  if (probe.error && /schema cache|could not find the table|does not exist/i.test(probe.error.message)) {
    return json(
      {
        error:
          "The Sift tables are not in Supabase yet. Run the database migration, then sign in again.",
      },
      500,
    );
  }

  let signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error) {
    const message = signed.error.message.toLowerCase();
    if (message.includes("invalid login")) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error) {
        return json(
          { error: "That email is already registered. Check the password." },
          401,
        );
      }
      signed = await anon.auth.signInWithPassword({ email, password });
    } else if (message.includes("not confirmed")) {
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listed.data.users.find(
        (user) => user.email?.toLowerCase() === email,
      );
      if (!existing) {
        return json({ error: "Confirm that email, then try again." }, 401);
      }
      const confirmed = await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
      });
      if (confirmed.error) return json({ error: confirmed.error.message }, 500);
      signed = await anon.auth.signInWithPassword({ email, password });
    }
  }

  if (signed.error || !signed.data.session || !signed.data.user) {
    return json({ error: signed.error?.message ?? "Could not sign in." }, 401);
  }

  const userId = signed.data.user.id;
  const existing = await admin
    .from("owners")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing.error) {
    const missing = /schema cache|could not find the table|does not exist/i.test(
      existing.error.message,
    );
    return json(
      {
        error: missing
          ? "The Sift tables are not in Supabase yet. Run the database migration, then sign in again."
          : existing.error.message,
      },
      500,
    );
  }

  const demoPhone = ownerPhone || DEMO_OWNER_PHONE;
  if (!existing.data) {
    const sealed = sealOwner({
      id: userId,
      name: displayName(email),
      aliases: [],
      phone: demoPhone,
    });
    const inserted = await admin.from("owners").insert({
      ...sealed,
      timezone: "America/Los_Angeles",
      photon_number: DEMO_PHOTON_NUMBER,
    });
    if (inserted.error) return json({ error: inserted.error.message }, 500);
  } else {
    const owner = await getOwnerByUserId(admin, userId);
    if (owner) {
      const nextPhone = owner.phone.trim() || demoPhone;
      const sealed = sealOwner({
        ...owner,
        phone: nextPhone,
      });
      const updated = await admin
        .from("owners")
        .update({
          phone: sealed.phone,
          photon_number: DEMO_PHOTON_NUMBER,
        })
        .eq("id", owner.id);
      if (updated.error) return json({ error: updated.error.message }, 500);
    }
  }

  return json({
    access_token: signed.data.session.access_token,
    refresh_token: signed.data.session.refresh_token,
    needs_phone: false,
    phone_saved: true,
  });
}

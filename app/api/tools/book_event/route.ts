import { bookEventRequestSchema } from "@/lib/contracts";
import { slotIsFree, withinOfficeHours } from "@/app/api/tools/calendar";
import {
  getCallByConversation,
  getOwner,
  insertEvent,
  json,
  rejectIfUnauthorized,
  serviceClient,
} from "@/app/api/tools/db";

export async function POST(req: Request) {
  const unauthorized = rejectIfUnauthorized(req);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = bookEventRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const { conversation_id, title, starts_at, ends_at, caller_name } =
    parsed.data;

  try {
    const supabase = serviceClient();
    const [owner, call] = await Promise.all([
      getOwner(supabase),
      getCallByConversation(supabase, conversation_id),
    ]);
    if (!call) return json({ error: "unknown conversation" }, 404);

    const timeZone = owner.timezone || "America/Los_Angeles";
    if (!withinOfficeHours(starts_at, ends_at, timeZone)) {
      await insertEvent(supabase, call.id, "tool", {
        tool: "book_event",
        ok: false,
        reason: "outside office hours",
        title,
        starts_at,
        ends_at,
      });
      return json({
        ok: false,
        event_id: "",
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("calendar_events")
      .select("starts_at, ends_at, status")
      .eq("owner_id", owner.id);
    if (existingError) throw new Error(existingError.message);
    const busy = (existing ?? []).flatMap((event) => {
      if (event.status === "missed" || !event.starts_at || !event.ends_at) {
        return [];
      }
      return [{ starts_at: event.starts_at, ends_at: event.ends_at }];
    });
    if (!slotIsFree(starts_at, ends_at, busy)) {
      await insertEvent(supabase, call.id, "tool", {
        tool: "book_event",
        ok: false,
        reason: "overlap",
        title,
        starts_at,
        ends_at,
      });
      return json({ ok: false, event_id: "" });
    }

    const { data: created, error } = await supabase
      .from("calendar_events")
      .insert({
        owner_id: owner.id,
        title,
        starts_at,
        ends_at,
        source: "sift",
        status: "planned",
        call_id: call.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const update: Record<string, unknown> = { caller_name };
    if (!call.action || call.action === "none") update.action = "booked";
    const { error: callError } = await supabase
      .from("calls")
      .update(update)
      .eq("id", call.id);
    if (callError) throw new Error(callError.message);

    await insertEvent(supabase, call.id, "tool", {
      tool: "book_event",
      ok: true,
      event_id: created.id,
      title,
      starts_at,
      ends_at,
      caller_name,
    });

    return json({ ok: true, event_id: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "book failed";
    console.error("book_event", message);
    return json({ error: message }, 500);
  }
}

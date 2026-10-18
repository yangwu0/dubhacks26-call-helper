import { checkAvailabilityRequestSchema } from "@/lib/contracts";
import { freeWindows } from "@/app/api/tools/calendar";
import {
  getCallByConversation,
  insertEvent,
  json,
  ownerForCall,
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

  const parsed = checkAvailabilityRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const { conversation_id, date_from, date_to } = parsed.data;

  try {
    const supabase = serviceClient();
    const call = await getCallByConversation(supabase, conversation_id);
    if (!call) return json({ error: "unknown conversation" }, 404);
    const owner = await ownerForCall(supabase, call);
    if (!owner) {
      return json({ error: "No person is matched for this call yet." }, 409);
    }

    const timeZone = owner.timezone || "America/Los_Angeles";
    const { data, error } = await supabase
      .from("calendar_events")
      .select("starts_at, ends_at, status")
      .eq("owner_id", owner.id);
    if (error) throw new Error(error.message);

    const events = (data ?? []).flatMap((event) => {
      if (event.status === "missed" || !event.starts_at || !event.ends_at) {
        return [];
      }
      return [{ starts_at: event.starts_at, ends_at: event.ends_at }];
    });
    const free_slots = freeWindows({
      timeZone,
      dateFrom: date_from,
      dateTo: date_to,
      events,
    });

    await insertEvent(supabase, call.id, "tool", {
      tool: "check_availability",
      date_from,
      date_to,
      slots: free_slots.length,
    });

    return json({ free_slots });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "availability failed";
    const status = message.startsWith("invalid date") ? 400 : 500;
    console.error("check_availability", message);
    return json({ error: message }, status);
  }
}

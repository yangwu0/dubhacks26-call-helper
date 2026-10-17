import { getOwner, serviceClient } from "@/app/api/tools/db";
import { createWeeklyReport } from "@/lib/commands";
import { getMessagingProvider } from "@/lib/messaging";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  try {
    return json(await createWeeklyReport());
  } catch (error) {
    const message = error instanceof Error ? error.message : "report failed";
    console.error("weekly report", message);
    return json({ error: message }, 500);
  }
}

export async function POST() {
  try {
    const supabase = serviceClient();
    const report = await createWeeklyReport(supabase);
    const owner = await getOwner(supabase);
    const address = owner.imessage_handle || owner.phone;
    const channel =
      (process.env.MESSAGING_PROVIDER ?? "photon") === "sms" ? "sms" : "imessage";
    await getMessagingProvider().send(address, report.text);
    const { error } = await supabase.from("messages").insert({
      direction: "out",
      channel,
      address,
      body: report.text,
    });
    if (error) throw new Error(error.message);
    return json({ ok: true, ...report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "report failed";
    console.error("weekly report send", message);
    return json({ error: message }, 500);
  }
}

import { ownerFromRequest, resolveOwner, serviceClient } from "@/app/api/tools/db";
import { createWeeklyReport } from "@/lib/commands";
import { getMessagingProvider } from "@/lib/messaging";
import { DEMO_OWNER_PHONE } from "@/lib/owner-phone";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function ownerForReport(req: Request) {
  return (await ownerFromRequest(req)) ?? resolveOwner(serviceClient());
}

export async function GET(req: Request) {
  try {
    const owner = await ownerForReport(req);
    return json(await createWeeklyReport(serviceClient(), owner));
  } catch (error) {
    const message = error instanceof Error ? error.message : "report failed";
    console.error("weekly report", message);
    return json({ error: message }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const supabase = serviceClient();
    const owner = await ownerForReport(req);
    const report = await createWeeklyReport(supabase, owner);
    const address = DEMO_OWNER_PHONE;
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

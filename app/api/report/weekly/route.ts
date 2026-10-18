import { ownerFromRequest, resolveOwner, serviceClient } from "@/app/api/tools/db";
import { createWeeklyReport } from "@/lib/commands";

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

/** Same as GET: build the report for the dashboard. Messaging send is disabled. */
export async function POST(req: Request) {
  try {
    const owner = await ownerForReport(req);
    const report = await createWeeklyReport(serviceClient(), owner);
    return json({ ok: true, ...report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "report failed";
    console.error("weekly report", message);
    return json({ error: message }, 500);
  }
}

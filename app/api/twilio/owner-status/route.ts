import { json } from "@/app/api/tools/db";

/** Twilio is not used; kept so old webhook URLs fail clearly instead of 404. */
export async function POST() {
  return json({ error: "twilio_disabled" }, 410);
}

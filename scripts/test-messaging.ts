import { openOwner } from "../lib/account-crypto";
import { callSummarySchema } from "../lib/anthropic";
import { formatPostCallMessage, getMessagingProvider } from "../lib/messaging";
import { createServiceClient } from "../lib/supabase";

// Sends one sample post-call summary to a phone saved on an owner row.
// Usage: pnpm exec tsx --env-file=.env.local scripts/test-messaging.ts [+1...]
async function destination(): Promise<string> {
  const requested = process.argv[2]?.trim() ?? "";
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("owners")
    .select("id, name, aliases, phone, imessage_handle");
  if (error) throw new Error(error.message);
  const phones = (data ?? [])
    .map((row) => openOwner(row).phone.trim())
    .filter((phone) => phone.startsWith("+"));
  if (requested) {
    const match = phones.find((phone) => phone === requested);
    if (!match) throw new Error("That phone is not saved on an account.");
    return match;
  }
  if (phones.length === 1) return phones[0];
  if (phones.length === 0) throw new Error("No account has a phone saved.");
  throw new Error("More than one account has a phone. Pass the number as an argument.");
}

async function main() {
  const summary = callSummarySchema.parse({
    classification: "scam",
    risk_score: 94,
    scam_type: "irs",
    summary: "A caller pretended to be the IRS and demanded gift cards.",
    key_details: ["Demanded gift cards"],
    suggested_action: "block",
  });
  const body = formatPostCallMessage(summary);
  const to = await destination();
  console.log(body);
  await getMessagingProvider().send(to, body);
  console.log(`sent to ${to}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

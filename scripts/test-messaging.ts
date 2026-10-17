import { callSummarySchema } from "../lib/anthropic";
import { formatPostCallMessage, getMessagingProvider } from "../lib/messaging";

// Sends one sample post-call summary to OWNER_PHONE with the selected provider.
// Usage: pnpm exec tsx --env-file=.env.local scripts/test-messaging.ts
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
  const to = process.env.OWNER_PHONE?.trim();
  if (!to) throw new Error("OWNER_PHONE is required");
  console.log(body);
  await getMessagingProvider().send(to, body);
  console.log(`sent to ${to}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

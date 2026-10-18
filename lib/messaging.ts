import type { CallSummary } from "./anthropic";

export interface MessagingProvider {
  send(to: string, body: string): Promise<void>;
}

function withPeriod(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function formatPostCallMessage(summary: CallSummary): string {
  const detail = withPeriod(summary.summary);
  if (
    summary.classification === "scam" ||
    summary.suggested_action === "block"
  ) {
    const lead = detail.replace(/[.!?]$/, "");
    return `Blocked a likely scam (${summary.risk_score}%): ${lead}. Reply BLOCK to confirm / CALL to call back.`;
  }
  if (summary.suggested_action === "book") {
    return `${detail} Reply UNDO to cancel.`;
  }
  if (summary.suggested_action === "forward") {
    return `${detail} Reply CALL if you still want me to connect you.`;
  }
  return `${detail} Reply CALL to call back.`;
}

export class PhotonMessaging implements MessagingProvider {
  async send(to: string, body: string): Promise<void> {
    const { sendPhotonText } = await import("./photon-api");
    await sendPhotonText(to, body);
  }
}

export async function sendLiveRiskAlert(input: {
  to: string;
  callerLabel: string;
  callerNumber?: string | null;
  score: number;
  reason: string;
}): Promise<void> {
  const body = `Possible ${input.reason} (${input.score}%). ${input.callerLabel}. Reply BLOCK.`;
  const { sendAlertWithPoll } = await import("./photon");
  await sendAlertWithPoll(input.to, body, input.callerNumber);
}

export function getMessagingProvider(): MessagingProvider {
  const provider = process.env.MESSAGING_PROVIDER ?? "photon";
  if (provider === "photon") return new PhotonMessaging();
  throw new Error(
    `Unknown MESSAGING_PROVIDER "${provider}". Sift uses photon only.`,
  );
}

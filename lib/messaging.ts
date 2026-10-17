import type { CallSummary } from "./anthropic";
import { sendSms } from "./twilio";

export interface MessagingProvider {
  send(to: string, body: string): Promise<void>;
}

function withPeriod(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// Owner-facing text after a call. The summary field stays at two sentences;
// the reply hint is the command the owner can send back.
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

export class TwilioSmsMessaging implements MessagingProvider {
  async send(to: string, body: string): Promise<void> {
    await sendSms(to, body);
  }
}

// TODO(photon): WS3 implements this with spectrum-ts.
// Docs: https://photon.codes/docs/spectrum-ts/introduction
export class PhotonMessaging implements MessagingProvider {
  async send(to: string, body: string): Promise<void> {
    throw new Error(
      `TODO(photon): WS3 send via spectrum-ts to ${to} (${body.length} chars)`,
    );
  }
}

export function getMessagingProvider(): MessagingProvider {
  const provider = process.env.MESSAGING_PROVIDER ?? "photon";
  if (provider === "sms") return new TwilioSmsMessaging();
  if (provider === "photon") return new PhotonMessaging();
  throw new Error(
    `Unknown MESSAGING_PROVIDER "${provider}". Expected photon or sms.`,
  );
}

import type { CallSummary } from "./anthropic";
import { sendSms } from "./twilio";

export interface MessagingProvider {
  send(to: string, body: string): Promise<void>;
}

// TODO(photon): WS3 implements this with spectrum-ts.
// Docs: https://photon.codes/docs/spectrum-ts/introduction
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

// Stable Spectrum docs: https://photon.codes/docs/spectrum-ts/spaces-and-users
export class PhotonMessaging implements MessagingProvider {
  async send(to: string, body: string): Promise<void> {
    const { sendIMessage } = await import("./photon");
    await sendIMessage(to, body);
  }
}

// Live alert while a call is still going. report_risk should call this.
// Photon sends the text plus a Block/Allow poll. A voice note is added when
// ELEVENLABS_VOICE_ID is set.
export async function sendLiveRiskAlert(input: {
  to: string;
  callerLabel: string;
  callerNumber?: string | null;
  score: number;
  reason: string;
}): Promise<void> {
  const body = `Possible ${input.reason} (${input.score}%). ${input.callerLabel}. Reply BLOCK.`;
  const provider = process.env.MESSAGING_PROVIDER ?? "photon";
  if (provider === "sms") {
    await getMessagingProvider().send(input.to, body);
    return;
  }
  const { sendAlertWithPoll } = await import("./photon");
  await sendAlertWithPoll(input.to, body, input.callerNumber);
}

export function getMessagingProvider(): MessagingProvider {
  const provider = process.env.MESSAGING_PROVIDER ?? "photon";
  if (provider === "photon") return new PhotonMessaging();
  throw new Error(
    `Unknown MESSAGING_PROVIDER "${provider}". Sift uses photon only (Twilio SMS removed).`,
  );
}

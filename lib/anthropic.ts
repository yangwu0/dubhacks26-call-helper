import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod";

export function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export const callSummarySchema = z.object({
  classification: z.enum([
    "scam",
    "legit_important",
    "legit_routine",
    "unknown",
  ]),
  risk_score: z.number().int().min(0).max(100),
  scam_type: z.string().nullable(),
  summary: z.string().min(1),
  key_details: z.array(z.string()),
  suggested_action: z.enum([
    "block",
    "forward",
    "book",
    "take_message",
    "none",
  ]),
});

export type CallSummary = z.infer<typeof callSummarySchema>;

export type CallMeta = {
  caller_name?: string | null;
  caller_number?: string | null;
  caller_intent?: string | null;
  risk_score?: number | null;
  risk_reasons?: string[] | null;
  action?: string | null;
  target_match?: boolean | null;
};

const SUMMARY_SYSTEM = `You are Sift, a friendly phone assistant. Summarize one phone call for the owner.

Rules:
- Use only facts that appear in the transcript or the call metadata. Never invent names, dollar amounts, dates, threats, or outcomes.
- summary is at most two short sentences.
- classification is scam, legit_important, legit_routine, or unknown.
- risk_score is an integer from 0 to 100. Gift cards, arrest threats, and secrecy score high. A real office, school, landlord, or delivery scores low.
- scam_type is a short label such as "irs" or "warranty", or null when this is not a scam.
- key_details lists concrete facts from the call. Use an empty list when you have none.
- suggested_action is block, forward, book, take_message, or none.

These three examples are samples of the output shape. They are not the call you are summarizing.

Example 1, IRS scam.
Transcript: The caller says they are the IRS, that Alex owes taxes, and that Alex must pay with gift cards today or be arrested.
{"classification":"scam","risk_score":94,"scam_type":"irs","summary":"A caller pretended to be the IRS and demanded gift cards to avoid arrest.","key_details":["Claimed to be the IRS","Demanded gift cards","Threatened arrest"],"suggested_action":"block"}

Example 2, doctor's office.
Transcript: Dr. Lee's office asks to move Thursday's appointment and offers Friday at 2pm. The agent books Friday at 2pm.
{"classification":"legit_important","risk_score":8,"scam_type":null,"summary":"Dr. Lee's office called to move Thursday's appointment. Friday at 2pm is booked.","key_details":["Caller: Dr. Lee's office","New time: Friday 2pm"],"suggested_action":"book"}

Example 3, delivery.
Transcript: A driver says a package will arrive today between 4 and 6pm. They do not ask for payment.
{"classification":"legit_routine","risk_score":12,"scam_type":null,"summary":"A delivery driver called to say a package arrives today between 4 and 6pm.","key_details":["Delivery window: today 4-6pm"],"suggested_action":"take_message"}`;

function modelName(): string {
  const model = process.env.ANTHROPIC_MODEL?.trim();
  if (!model) throw new Error("ANTHROPIC_MODEL is required");
  return model;
}

function clampScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function sentenceCount(text: string): number {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function clipSentences(text: string, max: number): string {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(" ")
    .trim();
}

function missingTranscript(callMeta: CallMeta): CallSummary {
  return callSummarySchema.parse({
    classification: "unknown",
    risk_score: clampScore(callMeta.risk_score),
    scam_type: null,
    summary: "The transcript is missing, so I can't say what was discussed.",
    key_details: [],
    suggested_action: "none",
  });
}

async function buildSummary(
  transcript: string,
  callMeta: CallMeta,
): Promise<CallSummary> {
  const text = transcript.trim();
  if (!text) return missingTranscript(callMeta);

  const client = getAnthropicClient();
  const message = await client.messages.parse({
    model: modelName(),
    max_tokens: 1024,
    system: SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Call metadata:\n${JSON.stringify(callMeta)}\n\nTranscript:\n${text}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(callSummarySchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("Claude returned no summary JSON");
  }

  const clipped = {
    ...message.parsed_output,
    summary: clipSentences(message.parsed_output.summary, 2),
    risk_score: clampScore(message.parsed_output.risk_score),
  };
  return callSummarySchema.parse(clipped);
}

const imageMediaTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type ScanImageType = (typeof imageMediaTypes)[number];

export const scanResultSchema = z.object({
  verdict: z.enum(["safe", "suspicious", "scam"]),
  reasons: z.array(z.string()),
  plain_english_explanation: z.string().min(1),
  recommended_steps: z.array(z.string()),
  possible_errors: z.array(z.string()),
  questions_to_ask_provider: z.array(z.string()),
  ways_to_pay_less: z.array(z.string()),
});

export type ScanResult = z.infer<typeof scanResultSchema>;

const SCAN_SYSTEM = `You are Sift. The owner forwarded a message, email, or photo of a bill. Judge only what is in the content.

Rules:
- Never invent amounts, dates, account numbers, or errors that are not visible.
- If the content is missing or unreadable, verdict is suspicious, and the explanation says what you could not read.
- verdict is safe, suspicious, or scam.
- reasons are short facts from the content.
- plain_english_explanation is 2 to 4 sentences a non-expert can follow.
- recommended_steps are concrete next moves.
- possible_errors, questions_to_ask_provider, and ways_to_pay_less are for a medical bill or a lease only. For anything else, return empty arrays.`;

export function formatScanReply(result: ScanResult): string {
  const lines = [
    `${result.verdict}: ${result.plain_english_explanation}`,
    result.reasons.length ? `Why: ${result.reasons.join("; ")}` : "",
    result.recommended_steps.length
      ? `Next: ${result.recommended_steps.join(" ")}`
      : "",
    result.possible_errors.length
      ? `Possible errors: ${result.possible_errors.join("; ")}`
      : "",
    result.questions_to_ask_provider.length
      ? `Ask them: ${result.questions_to_ask_provider.join(" ")}`
      : "",
    result.ways_to_pay_less.length
      ? `Ways to pay less: ${result.ways_to_pay_less.join(" ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function isForwardedText(text: string): boolean {
  return /begin forwarded message|^fwd:|forwarded message/i.test(text.trim());
}

export async function scanContent(input: {
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
  mediaType?: ScanImageType;
}): Promise<ScanResult> {
  const text = input.text?.trim() ?? "";
  const imageUrl = input.imageUrl?.trim() ?? "";
  const imageBase64 = input.imageBase64?.trim() ?? "";
  if (!text && !imageUrl && !imageBase64) {
    throw new Error("Nothing to scan");
  }

  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source:
          | { type: "url"; url: string }
          | { type: "base64"; media_type: ScanImageType; data: string };
      }
  > = [];
  if (imageUrl) {
    content.push({ type: "image", source: { type: "url", url: imageUrl } });
  }
  if (imageBase64) {
    const mediaType = input.mediaType;
    if (!mediaType || !imageMediaTypes.includes(mediaType)) {
      throw new Error("image media type must be jpeg, png, gif, or webp");
    }
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: imageBase64 },
    });
  }
  content.push({
    type: "text",
    text: text || "The owner sent this image. Say if it is a bill.",
  });

  const client = getAnthropicClient();
  const message = await client.messages.parse({
    model: modelName(),
    max_tokens: 1024,
    system: SCAN_SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(scanResultSchema) },
  });
  if (!message.parsed_output) throw new Error("Claude returned no scan");
  return scanResultSchema.parse(message.parsed_output);
}

const weeklyParagraphSchema = z.object({
  paragraph: z.string().min(1),
});

// Three upbeat sentences. The caller checks that the computed insight is present.
export async function writeWeeklyParagraph(facts: {
  calls_handled: number;
  scams_blocked: number;
  meetings_booked: number;
  important_forwarded: number;
  minutes_saved: number;
  plan_vs_done: { planned: number; done: number; share: number };
  insight: string;
}): Promise<string> {
  const client = getAnthropicClient();
  const message = await client.messages.parse({
    model: modelName(),
    max_tokens: 400,
    system:
      "You write the owner's weekly Sift note. Exactly 3 upbeat sentences. Use only the numbers and the insight in the user message. Include the insight once, unchanged. Do not invent busiest hours, callers, or dollar amounts.",
    messages: [{ role: "user", content: JSON.stringify(facts) }],
    output_config: { format: zodOutputFormat(weeklyParagraphSchema) },
  });
  const paragraph = message.parsed_output?.paragraph?.trim();
  if (!paragraph) throw new Error("Claude returned no weekly paragraph");
  if (sentenceCount(paragraph) !== 3) {
    throw new Error("Weekly paragraph was not 3 sentences");
  }
  if (!paragraph.includes(facts.insight)) {
    throw new Error("Weekly paragraph dropped the computed insight");
  }
  return paragraph;
}

// One argument keeps the string the post-call route already stores and texts.
// Pass callMeta to get the validated JSON object.
export async function summarize(transcript: string): Promise<string>;
export async function summarize(
  transcript: string,
  callMeta: CallMeta,
): Promise<CallSummary>;
export async function summarize(
  transcript: string,
  callMeta?: CallMeta,
): Promise<string | CallSummary> {
  const structured = await buildSummary(transcript, callMeta ?? {});
  if (callMeta === undefined) {
    const { formatPostCallMessage } = await import("./messaging");
    return formatPostCallMessage(structured);
  }
  return structured;
}

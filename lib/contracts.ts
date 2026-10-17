import * as z from "zod";

// Shared tool and webhook contracts. Note changes in docs/CHANGELOG.md.

export const recommendedActionSchema = z.enum([
  "continue",
  "end_as_scam",
  "may_forward",
]);

export const verifyCallerTargetRequestSchema = z.object({
  conversation_id: z.string(),
  claimed_target: z.string(),
});

export const verifyCallerTargetResponseSchema = z.object({
  match: z.boolean(),
  confidence: z.number(),
});

export const reportRiskRequestSchema = z.object({
  conversation_id: z.string(),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  caller_intent: z.string(),
  caller_name: z.string().optional(),
});

export const reportRiskResponseSchema = z.object({
  ok: z.boolean(),
  recommended_action: recommendedActionSchema,
});

export const freeSlotSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export const checkAvailabilityRequestSchema = z.object({
  conversation_id: z.string(),
  date_from: z.string(),
  date_to: z.string(),
});

export const checkAvailabilityResponseSchema = z.object({
  free_slots: z.array(freeSlotSchema),
});

export const bookEventRequestSchema = z.object({
  conversation_id: z.string(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  caller_name: z.string(),
});

export const bookEventResponseSchema = z.object({
  ok: z.boolean(),
  event_id: z.string(),
});

export const forwardCallRequestSchema = z.object({
  conversation_id: z.string(),
  reason: z.string(),
  urgency: z.string(),
});

export const forwardCallResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export const takeMessageRequestSchema = z.object({
  conversation_id: z.string(),
  caller_name: z.string(),
  callback_number: z.string(),
  message: z.string(),
});

export const takeMessageResponseSchema = z.object({
  ok: z.boolean(),
});

// ElevenLabs Twilio personalization webhook.
// https://elevenlabs.io/docs/eleven-agents/customization/personalization/twilio-personalization
export const elevenLabsInitRequestSchema = z.object({
  caller_id: z.string(),
  agent_id: z.string(),
  called_number: z.string(),
  call_sid: z.string(),
  conversation_id: z.string(),
});

export const elevenLabsInitResponseSchema = z.object({
  type: z.literal("conversation_initiation_client_data"),
  dynamic_variables: z.object({
    owner_name: z.string(),
    caller_number: z.string(),
    is_blocked: z.boolean(),
    is_known_contact: z.boolean(),
    call_sid: z.string(),
  }),
});

const transcriptTurnSchema = z.looseObject({
  role: z.string(),
  message: z.string().optional(),
  time_in_call_secs: z.number().optional(),
});

// ElevenLabs post-call transcription webhook.
// https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
export const postCallTranscriptionSchema = z.object({
  type: z.literal("post_call_transcription"),
  event_timestamp: z.number(),
  data: z.looseObject({
    agent_id: z.string(),
    conversation_id: z.string(),
    status: z.string().optional(),
    transcript: z.array(transcriptTurnSchema).optional(),
    analysis: z
      .looseObject({
        transcript_summary: z.string().optional(),
      })
      .optional(),
  }),
});

export const postCallAudioSchema = z.object({
  type: z.literal("post_call_audio"),
  event_timestamp: z.number(),
  data: z.object({
    agent_id: z.string(),
    conversation_id: z.string(),
    full_audio: z.string(),
  }),
});

export const callInitiationFailureSchema = z.object({
  type: z.literal("call_initiation_failure"),
  event_timestamp: z.number(),
  data: z.looseObject({
    agent_id: z.string(),
    conversation_id: z.string(),
    failure_reason: z.enum(["busy", "no-answer", "unknown"]),
  }),
});

export const postCallWebhookSchema = z.discriminatedUnion("type", [
  postCallTranscriptionSchema,
  postCallAudioSchema,
  callInitiationFailureSchema,
]);

export type RecommendedAction = z.infer<typeof recommendedActionSchema>;
export type VerifyCallerTargetRequest = z.infer<
  typeof verifyCallerTargetRequestSchema
>;
export type VerifyCallerTargetResponse = z.infer<
  typeof verifyCallerTargetResponseSchema
>;
export type ReportRiskRequest = z.infer<typeof reportRiskRequestSchema>;
export type ReportRiskResponse = z.infer<typeof reportRiskResponseSchema>;
export type FreeSlot = z.infer<typeof freeSlotSchema>;
export type CheckAvailabilityRequest = z.infer<
  typeof checkAvailabilityRequestSchema
>;
export type CheckAvailabilityResponse = z.infer<
  typeof checkAvailabilityResponseSchema
>;
export type BookEventRequest = z.infer<typeof bookEventRequestSchema>;
export type BookEventResponse = z.infer<typeof bookEventResponseSchema>;
export type ForwardCallRequest = z.infer<typeof forwardCallRequestSchema>;
export type ForwardCallResponse = z.infer<typeof forwardCallResponseSchema>;
export type TakeMessageRequest = z.infer<typeof takeMessageRequestSchema>;
export type TakeMessageResponse = z.infer<typeof takeMessageResponseSchema>;
export type ElevenLabsInitRequest = z.infer<typeof elevenLabsInitRequestSchema>;
export type ElevenLabsInitResponse = z.infer<
  typeof elevenLabsInitResponseSchema
>;
export type PostCallTranscription = z.infer<typeof postCallTranscriptionSchema>;
export type PostCallWebhook = z.infer<typeof postCallWebhookSchema>;

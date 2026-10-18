import type { RecommendedAction } from "@/lib/contracts";

export const SCAM_SCORE = 75;
export const FORWARD_MAX_SCORE = 40;
export const EXPLICIT_DROP = 20;

export type RiskDecision = {
  score: number;
  reasons: string[];
  rejectedDrop: boolean;
  recommendedAction: RecommendedAction;
};

export function applyRiskRules(input: {
  reportedScore: number;
  previousScore: number;
  reasons: string[];
  isBlocked: boolean;
  targetMatch: boolean | null;
}): RiskDecision {
  const reasons = input.reasons.map((reason) => reason.trim()).filter(Boolean);
  let score = Math.min(100, Math.max(0, Math.round(input.reportedScore)));
  if (input.isBlocked) {
    score = Math.min(100, score + 100);
  }

  const previous = Math.min(100, Math.max(0, Math.round(input.previousScore)));
  let rejectedDrop = false;
  const drop = previous - score;
  if (drop > 0) {
    const explicit = drop >= EXPLICIT_DROP && reasons.length > 0;
    if (!explicit) {
      score = previous;
      rejectedDrop = true;
    }
  }

  let recommendedAction: RecommendedAction = "continue";
  if (input.isBlocked || score >= SCAM_SCORE) {
    recommendedAction = "end_as_scam";
  } else if (input.targetMatch === true && score < FORWARD_MAX_SCORE) {
    recommendedAction = "may_forward";
  }

  return { score, reasons, rejectedDrop, recommendedAction };
}

const IMPORTANT_INTENT =
  /schedul|appointment|doctor|medical|clinic|hospital|school|teacher|landlord|lease|repair|maintenance|delivery|package|urgent/i;

export function classifyCall(input: {
  riskScore: number;
  targetMatch: boolean | null;
  action: string | null;
  summary: string | null;
}): { classification: string; action: string } {
  if (input.riskScore >= SCAM_SCORE) {
    return { classification: "scam", action: "blocked" };
  }
  if (input.action === "forwarded" || input.action === "booked") {
    return { classification: "legit_important", action: input.action };
  }
  const important =
    input.targetMatch === true &&
    input.riskScore < FORWARD_MAX_SCORE &&
    IMPORTANT_INTENT.test(input.summary ?? "");
  if (important) {
    return {
      classification: "legit_important",
      action: input.action && input.action !== "none" ? input.action : "none",
    };
  }
  if (input.riskScore < FORWARD_MAX_SCORE) {
    return {
      classification: "legit_routine",
      action:
        input.action && input.action !== "none" ? input.action : "message_taken",
    };
  }
  return {
    classification: "unknown",
    action: input.action && input.action !== "none" ? input.action : "none",
  };
}

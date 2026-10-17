export type RiskTone = "safe" | "warn" | "scam";

export const RISK_STROKE: Record<RiskTone, string> = {
  safe: "#34d399",
  warn: "#fbbf24",
  scam: "#fb7185",
};

export const RISK_LABEL: Record<RiskTone, string> = {
  safe: "Safe",
  warn: "Caution",
  scam: "Scam risk",
};

export function riskTone(score: number): RiskTone {
  if (score >= 75) return "scam";
  if (score >= 40) return "warn";
  return "safe";
}

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.min(100, Math.max(0, score));
}

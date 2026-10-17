"use client";

import { motion, useMotionValueEvent, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { clampScore, RISK_LABEL, RISK_STROKE, riskTone } from "@/components/risk-tone";

const SIZE = 232;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RiskGauge({ score }: { score: number }) {
  const safeScore = clampScore(score);
  const spring = useSpring(0, { stiffness: 42, damping: 16, mass: 0.9 });
  const dashOffset = useTransform(spring, (value) => {
    const next = clampScore(value);
    return CIRCUMFERENCE - (next / 100) * CIRCUMFERENCE;
  });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    spring.set(safeScore);
  }, [safeScore, spring]);

  useMotionValueEvent(spring, "change", (value) => {
    setShown(Math.round(clampScore(value)));
  });

  const tone = riskTone(shown);
  const color = RISK_STROKE[tone];

  return (
    <div
      className="relative grid place-items-center"
      role="meter"
      aria-label="Scam risk"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeScore)}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-base-300)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset, rotate: -90, transformOrigin: "50% 50%" }}
          initial={false}
          animate={{ stroke: color }}
          transition={{ duration: 0.35 }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-6xl font-bold leading-none text-base-content">{shown}</div>
        <div className="mt-1 text-xs font-semibold" style={{ color }}>
          {RISK_LABEL[tone]}
        </div>
      </div>
    </div>
  );
}

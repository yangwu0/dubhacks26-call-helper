"use client";

import { motion, useMotionValueEvent, useSpring } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { clampScore } from "@/components/risk-tone";

export function RiskGauge({ score, badge }: { score: number; badge?: ReactNode }) {
  const safeScore = clampScore(score);
  const spring = useSpring(0, { stiffness: 80, damping: 18, mass: 0.8 });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    spring.set(safeScore);
  }, [safeScore, spring]);

  useMotionValueEvent(spring, "change", (value) => {
    setShown(Math.round(clampScore(value)));
  });

  return (
    <div
      className="relative mx-auto grid w-full max-w-56 place-items-center sm:max-w-64"
      role="meter"
      aria-label="Scam risk"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeScore)}
    >
      <svg viewBox="0 0 220 220" className="w-full" aria-hidden>
        <circle cx="110" cy="110" r="86" fill="none" stroke="var(--color-primary)" strokeWidth="16" />
      </svg>
      <div className="absolute flex flex-col items-center gap-3">
        <motion.div className="text-5xl font-semibold tabular-nums leading-none tracking-tight text-base-content">
          {shown}
        </motion.div>
        {badge}
      </div>
    </div>
  );
}

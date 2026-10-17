"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_INTERVAL_MS,
  SCAM_DEMO_STEPS,
  type DemoStep,
  type RoutingStatus,
  type TranscriptLine,
} from "@/lib/mockCallData";

export function useDemoPlayback() {
  const [running, setRunning] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [step, setStep] = useState<DemoStep | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const timer = useRef<number | null>(null);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }

  function stop() {
    clearTimer();
    setRunning(false);
    setEngaged(false);
    setStep(null);
    setLines([]);
  }

  function start() {
    clearTimer();
    setLines([]);
    setStep(null);
    setEngaged(true);
    setRunning(true);
    let index = 0;
    timer.current = window.setInterval(() => {
      const next = SCAM_DEMO_STEPS[index];
      if (!next) {
        clearTimer();
        setRunning(false);
        return;
      }
      const stepIndex = index;
      setStep(next);
      setLines((current) => [
        ...current,
        ...next.lines.map((line, offset) => ({
          ...line,
          id: `demo-${stepIndex}-${offset}`,
          at: new Date().toISOString(),
        })),
      ]);
      index += 1;
      if (index >= SCAM_DEMO_STEPS.length) {
        clearTimer();
        setRunning(false);
      }
    }, DEMO_INTERVAL_MS);
  }

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, []);

  function toggle() {
    if (running) stop();
    else start();
  }

  const action: RoutingStatus = engaged ? (step?.action ?? "screening") : "waiting";

  return {
    running,
    engaged,
    score: step?.score ?? 0,
    reasons: step?.reasons ?? [],
    action,
    callerName: step?.callerName ?? (engaged ? "Connecting" : ""),
    callerNumber: step?.callerNumber ?? (engaged ? SCAM_DEMO_STEPS[0].callerNumber : ""),
    claimedTarget: step?.claimedTarget ?? (engaged ? SCAM_DEMO_STEPS[0].claimedTarget : ""),
    targetMatch: step?.targetMatch ?? null,
    lines,
    toggle,
  };
}

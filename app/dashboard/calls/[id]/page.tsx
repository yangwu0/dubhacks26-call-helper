"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ActionBadge, badgeForCall } from "@/components/action-badge";
import { formatPhone, formatWhen } from "@/components/format";
import { LiveTranscript } from "@/components/live-transcript";
import { RiskGauge } from "@/components/risk-gauge";
import { RISK_STROKE, riskTone } from "@/components/risk-tone";
import { useSiftDirectory } from "@/components/sift-provider";
import { bodyMuted, btnDanger, btnSafe, cardClass, cardHeading, pageTitle } from "@/components/styles";
import type { RiskPoint } from "@/lib/mockCallData";

function RiskTimeline({ points }: { points: RiskPoint[] }) {
  const width = 360;
  const height = 140;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 28) + 14;
    const y = height - 22 - (Math.min(100, Math.max(0, point.score)) / 100) * (height - 40);
    return { ...point, x, y };
  });
  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const tone = riskTone(points[points.length - 1]?.score ?? 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Risk over the call">
      <path d={path} fill="none" stroke={RISK_STROKE[tone]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((point) => (
        <circle key={`${point.at}-${point.score}`} cx={point.x} cy={point.y} r="5" fill={RISK_STROKE[tone]} />
      ))}
    </svg>
  );
}

function CallDetailInner() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { calls, blocked, addBlocked, removeBlocked } = useSiftDirectory();
  const call = calls.find((item) => item.id === id);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  if (!call) {
    return (
      <div className={`${cardClass} card-body items-start`}>
        <h1 className="font-display text-3xl font-extrabold">That call isn&apos;t here</h1>
        <Link href="/dashboard/calls" className="link link-primary mt-4 font-bold">
          Back to calls
        </Link>
      </div>
    );
  }

  const isBlocked = blocked.some((item) => item.number === call.callerNumber);

  async function onToggleBlock() {
    if (!call) return;
    setPending(true);
    const result = isBlocked
      ? await removeBlocked(call.callerNumber)
      : await addBlocked(call.callerNumber, call.summary || "Blocked from the dashboard");
    setNote(result.message);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/calls" className="link link-hover text-base font-semibold">
          All calls
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={pageTitle}>{call.callerName}</h1>
            <p className="mt-1 text-lg text-base-content/70">
              {formatPhone(call.callerNumber)} · {formatWhen(call.startedAt)}
            </p>
          </div>
          <ActionBadge status={badgeForCall(call)} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        {call.transcript.length > 0 ? (
          <LiveTranscript lines={call.transcript} />
        ) : (
          <section className={cardClass}>
            <div className="card-body">
              <h2 className={cardHeading}>
                {call.classification === "scam" ? "Scam summary" : "Message"}
              </h2>
              <p className={`mt-3 ${bodyMuted}`}>
                {call.summary ||
                  call.callerIntent ||
                  (call.status === "in_progress"
                    ? "Sift is on the line. Transcripts are not saved."
                    : "No summary for this call yet.")}
              </p>
              {call.classification !== "scam" && call.callerIntent && call.summary !== call.callerIntent ? (
                <p className="mt-3 text-sm text-base-content/60">
                  Also noted: {call.callerIntent}
                </p>
              ) : null}
            </div>
          </section>
        )}
        <div className="flex flex-col gap-5">
          <section className={cardClass}>
            <div className="card-body items-center">
              <RiskGauge score={call.riskScore} />
              <p className="text-base text-base-content/70">
                {call.targetMatch === true
                  ? "Name check: match"
                  : call.targetMatch === false
                    ? "Name check: mismatch"
                    : "Name check: unknown"}
              </p>
            </div>
          </section>
          <section className={cardClass}>
            <div className="card-body">
              <h2 className={cardHeading}>Risk timeline</h2>
              <RiskTimeline points={call.riskTimeline} />
              <ul className="mt-3 space-y-2">
                {call.riskReasons.map((reason) => (
                  <li key={reason} className="rounded-box bg-base-200/70 px-3 py-2">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className={cardClass}>
            <div className="card-body">
              <h2 className={cardHeading}>Summary</h2>
              <p className={`mt-2 ${bodyMuted}`}>
                {call.summary || "Sift hasn't written a summary for this call yet."}
              </p>
              <p className="mt-3 font-bold text-base-content/70">
                Action taken: {call.action === "none" ? "Still deciding" : call.action.replace(/_/g, " ")}
              </p>
              <button
                type="button"
                onClick={onToggleBlock}
                disabled={pending || !call.callerNumber}
                className={`mt-5 ${isBlocked ? btnSafe : btnDanger}`}
              >
                {isBlocked ? "Unblock number" : "Block number"}
              </button>
              {note ? <p className="mt-3 text-base text-base-content/65">{note}</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function CallDetailPage() {
  return (
    <Suspense
      fallback={
        <div className={`${cardClass} card-body`}>
          <h1 className="font-display text-3xl font-extrabold">Opening the call</h1>
        </div>
      }
    >
      <CallDetailInner />
    </Suspense>
  );
}

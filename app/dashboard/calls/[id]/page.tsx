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
import { cardClass } from "@/components/styles";
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
      <div className={`${cardClass} px-8 py-12`}>
        <h1 className="font-display text-3xl font-extrabold">That call isn&apos;t here</h1>
        <Link href="/dashboard/calls" className="mt-4 inline-block font-semibold text-emerald-700">
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
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/dashboard/calls" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          All calls
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight">{call.callerName}</h1>
            <p className="mt-1 text-slate-500">
              {formatPhone(call.callerNumber)} · {formatWhen(call.startedAt)}
            </p>
          </div>
          <ActionBadge status={badgeForCall(call)} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <LiveTranscript lines={call.transcript} />
        <div className="flex flex-col gap-5">
          <section className={`${cardClass} flex flex-col items-center px-6 py-6`}>
            <RiskGauge score={call.riskScore} />
            <p className="mt-2 text-sm text-slate-500">
              {call.targetMatch === true
                ? "Name check: match"
                : call.targetMatch === false
                  ? "Name check: mismatch"
                  : "Name check: unknown"}
            </p>
          </section>
          <section className={`${cardClass} px-6 py-5`}>
            <h2 className="font-display text-xl font-extrabold">Risk timeline</h2>
            <RiskTimeline points={call.riskTimeline} />
            <ul className="mt-2 space-y-2">
              {call.riskReasons.map((reason) => (
                <li key={reason} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {reason}
                </li>
              ))}
            </ul>
          </section>
          <section className={`${cardClass} px-6 py-5`}>
            <h2 className="font-display text-xl font-extrabold">Summary</h2>
            <p className="mt-2 leading-relaxed text-slate-600">
              {call.summary || "Sift hasn't written a summary for this call yet."}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Action taken: {call.action === "none" ? "Still deciding" : call.action.replace(/_/g, " ")}
            </p>
            <button
              type="button"
              onClick={onToggleBlock}
              disabled={pending || !call.callerNumber}
              className={`mt-5 rounded-3xl px-5 py-3 font-semibold disabled:opacity-60 ${
                isBlocked
                  ? "bg-emerald-400 text-emerald-950"
                  : "bg-rose-400 text-rose-950"
              }`}
            >
              {isBlocked ? "Unblock number" : "Block number"}
            </button>
            {note ? <p className="mt-3 text-sm text-slate-500">{note}</p> : null}
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
        <div className={`${cardClass} px-8 py-12`}>
          <h1 className="font-display text-3xl font-extrabold">Opening the call</h1>
        </div>
      }
    >
      <CallDetailInner />
    </Suspense>
  );
}

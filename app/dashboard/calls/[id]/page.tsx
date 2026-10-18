"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ActionBadge, badgeForCall } from "@/components/action-badge";
import { formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { useSiftDirectory } from "@/components/sift-provider";
import {
  bodyMuted,
  btnDanger,
  btnSafe,
  cardClass,
  cardHeading,
  metaMuted,
  pageTitle,
  riskPill,
} from "@/components/styles";

function CallDetailInner() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { calls, flagged, addFlagged, removeFlagged } = useSiftDirectory();
  const call = calls.find((item) => item.id === id);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  if (!call) {
    return (
      <div className={`${cardClass} card-body items-start`}>
        <h1 className="font-display text-3xl font-extrabold">That call isn&apos;t here</h1>
        <Link href="/" className="link link-primary mt-4 font-bold">
          Back to the log
        </Link>
      </div>
    );
  }

  const isFlagged = flagged.some((item) => item.number === call.callerNumber);
  const tone = riskTone(call.riskScore);

  async function onToggleFlag() {
    if (!call) return;
    setPending(true);
    const result = isFlagged
      ? await removeFlagged(call.callerNumber)
      : await addFlagged(call.callerNumber, call.summary || "Flagged from the dashboard");
    setNote(result.message);
    setPending(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <Link href="/" className={`link link-hover ${metaMuted} font-semibold`}>
          Log
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={pageTitle}>{call.callerName}</h1>
            <p className={`mt-1 ${bodyMuted}`}>
              {formatPhone(call.callerNumber)} · {formatWhen(call.startedAt)}
            </p>
          </div>
          <ActionBadge status={badgeForCall(call)} />
        </div>
      </div>

      <section className={cardClass}>
        <div className="card-body">
          <h2 className={cardHeading}>
            {call.classification === "scam" ? "Scam summary" : "Summary"}
          </h2>
          <p className={`mt-3 ${bodyMuted}`}>
            {call.summary ||
              (call.status === "in_progress"
                ? "Sift is on the line."
                : "No summary for this call yet.")}
          </p>
        </div>
      </section>

      <section className={cardClass}>
        <div className="card-body gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className={cardHeading}>Risk</h2>
            <span className={riskPill[tone]}>{call.riskScore}</span>
          </div>
          <p className={bodyMuted}>
            {call.targetMatch === true
              ? "Name check: match"
              : call.targetMatch === false
                ? "Name check: mismatch"
                : "Name check: unknown"}
          </p>
          {call.riskReasons.length > 0 ? (
            <ul className="space-y-2">
              {call.riskReasons.map((reason) => (
                <li key={reason} className="rounded-box bg-base-200/70 px-3 py-2">
                  {reason}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-base font-semibold text-base-content/75">
            Action taken: {call.action === "none" ? "Still deciding" : call.action.replace(/_/g, " ")}
          </p>
          <button
            type="button"
            onClick={onToggleFlag}
            disabled={pending || !call.callerNumber}
            className={isFlagged ? btnSafe : btnDanger}
          >
            {isFlagged ? "Unflag number" : "Flag number"}
          </button>
          {note ? <p className={metaMuted}>{note}</p> : null}
        </div>
      </section>
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

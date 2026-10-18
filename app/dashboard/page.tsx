"use client";

import { ActionBadge, badgeForCall } from "@/components/action-badge";
import { CallStrip } from "@/components/call-strip";
import { DemoToggle } from "@/components/demo-toggle";
import { formatPhone } from "@/components/format";
import { LiveTranscript } from "@/components/live-transcript";
import { RiskGauge } from "@/components/risk-gauge";
import { useSiftDirectory } from "@/components/sift-provider";
import { useDemoPlayback } from "@/components/use-demo-playback";
import {
  bodyMuted,
  cardClass,
  labelCaps,
  metaMuted,
  pageEyebrow,
  pageTitle,
  riskPill,
  sectionTitle,
} from "@/components/styles";
import type { CallRecord, RoutingStatus, TranscriptLine } from "@/lib/mockCallData";
import { useState } from "react";

function LiveCallButton({
  call,
  selected,
  onSelect,
}: {
  call: CallRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = call.callerName && call.callerName !== "Unknown caller"
    ? call.callerName
    : formatPhone(call.callerNumber);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`btn btn-sm font-semibold ${selected ? "btn-primary" : "btn-ghost"}`}
    >
      {label || "Live call"}
    </button>
  );
}

function NameCheck({ match }: { match: boolean | null }) {
  if (match === true) {
    return <span className={`${riskPill.safe} badge-md`}>Name check: match</span>;
  }
  if (match === false) {
    return <span className={`${riskPill.scam} badge-md`}>Name check: mismatch</span>;
  }
  return (
    <span className="badge badge-neutral badge-soft badge-md font-bold">Name check: still listening</span>
  );
}

export default function LivePage() {
  const { calls } = useSiftDirectory();
  const demo = useDemoPlayback();
  const liveCalls = calls.filter((call) => call.status === "in_progress");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const live = demo.engaged
    ? null
    : (liveCalls.find((call) => call.id === selectedId) ?? liveCalls[0] ?? null);
  const showingLive = demo.engaged || live !== null;

  const score = demo.engaged ? demo.score : (live?.riskScore ?? 0);
  const reasons = demo.engaged ? demo.reasons : (live?.riskReasons ?? []);
  const status: RoutingStatus = demo.engaged
    ? demo.action
    : live
      ? badgeForCall(live)
      : "waiting";
  const lines: TranscriptLine[] = demo.engaged ? demo.lines : (live?.transcript ?? []);
  const callerName = demo.engaged
    ? demo.callerName || "Sample caller"
    : (live?.callerName ?? "No call right now");
  const callerNumber = demo.engaged ? demo.callerNumber : (live?.callerNumber ?? "");
  const claimedTarget = demo.engaged ? demo.claimedTarget : (live?.claimedTarget ?? "");
  const targetMatch = demo.engaged ? demo.targetMatch : (live?.targetMatch ?? null);
  const intent = demo.engaged ? "" : (live?.callerIntent ?? "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={pageEyebrow}>Right now</p>
          <h1 className={pageTitle}>Live</h1>
        </div>
        <DemoToggle running={demo.running} onToggle={demo.toggle} />
      </div>
      {demo.engaged ? (
        <p className={metaMuted}>Sample scam call. Nothing here is a real caller.</p>
      ) : liveCalls.length > 1 ? (
        <div className="flex flex-wrap gap-2" aria-label="Calls happening now">
          {liveCalls.map((call) => (
            <LiveCallButton
              key={call.id}
              call={call}
              selected={call.id === live?.id}
              onSelect={() => setSelectedId(call.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <section className={`${cardClass} bg-base-100`}>
          <div className="card-body items-center text-center">
            <p className={labelCaps}>
              {showingLive ? "Incoming" : "All quiet"}
            </p>
            <h2 className={sectionTitle}>{callerName}</h2>
            <p className={bodyMuted}>
              {callerNumber ? formatPhone(callerNumber) : "Sift will pick up when someone calls."}
            </p>
            {showingLive && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <NameCheck match={targetMatch} />
                {claimedTarget ? (
                  <span className="badge badge-neutral badge-soft">Asking for {claimedTarget}</span>
                ) : null}
              </div>
            )}
            {intent ? <p className={`max-w-sm ${bodyMuted}`}>{intent}</p> : null}
            <div className="my-4">
              <RiskGauge score={score} />
            </div>
            <ActionBadge status={status} />
            {reasons.length > 0 ? (
              <ul className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
                {reasons.map((reason) => (
                  <li key={reason}>
                    <span className="badge badge-outline badge-sm font-normal">{reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
        <LiveTranscript lines={lines} />
      </div>
      <CallStrip calls={calls} />
    </div>
  );
}

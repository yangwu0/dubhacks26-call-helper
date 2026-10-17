"use client";

import { ActionBadge, badgeForCall } from "@/components/action-badge";
import { CallStrip } from "@/components/call-strip";
import { formatPhone } from "@/components/format";
import { LiveTranscript } from "@/components/live-transcript";
import { RiskGauge } from "@/components/risk-gauge";
import { useSiftDirectory } from "@/components/sift-provider";
import {
  bodyMuted,
  cardClass,
  labelCaps,
  pageEyebrow,
  pageTitle,
  riskPill,
  sectionTitle,
} from "@/components/styles";
import type { RoutingStatus, TranscriptLine } from "@/lib/mockCallData";

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
  const live = calls.find((call) => call.status === "in_progress") ?? null;
  const showingLive = live !== null;

  const score = live?.riskScore ?? 0;
  const reasons = live?.riskReasons ?? [];
  const status: RoutingStatus = live ? badgeForCall(live) : "waiting";
  const lines: TranscriptLine[] = live?.transcript ?? [];
  const callerName = live?.callerName ?? "No call right now";
  const callerNumber = live?.callerNumber ?? "";
  const claimedTarget = live?.claimedTarget ?? "";
  const targetMatch = live?.targetMatch ?? null;
  const intent = live?.callerIntent ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className={pageEyebrow}>Right now</p>
        <h1 className={pageTitle}>Live</h1>
      </div>

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

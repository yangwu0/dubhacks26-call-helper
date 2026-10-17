"use client";

import { ActionBadge, badgeForCall } from "@/components/action-badge";
import { CallStrip } from "@/components/call-strip";
import { DemoToggle } from "@/components/demo-toggle";
import { formatPhone } from "@/components/format";
import { LiveTranscript } from "@/components/live-transcript";
import { RiskGauge } from "@/components/risk-gauge";
import { useSiftDirectory } from "@/components/sift-provider";
import { cardClass, pageEyebrow, pageTitle, riskPill } from "@/components/styles";
import { useDemoPlayback } from "@/components/use-demo-playback";
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
  const demo = useDemoPlayback();
  const { calls } = useSiftDirectory();
  const live = calls.find((call) => call.status === "in_progress") ?? null;
  const showingDemo = demo.engaged;
  const showingLive = !showingDemo && live !== null;

  const score = showingDemo ? demo.score : live?.riskScore ?? 0;
  const reasons = showingDemo ? demo.reasons : live?.riskReasons ?? [];
  const status: RoutingStatus = showingDemo
    ? demo.action
    : live
      ? badgeForCall(live)
      : "waiting";
  const lines: TranscriptLine[] = showingDemo ? demo.lines : live?.transcript ?? [];
  const callerName = showingDemo
    ? demo.callerName
    : live?.callerName ?? "No call right now";
  const callerNumber = showingDemo ? demo.callerNumber : live?.callerNumber ?? "";
  const claimedTarget = showingDemo ? demo.claimedTarget : live?.claimedTarget ?? "";
  const targetMatch = showingDemo ? demo.targetMatch : live?.targetMatch ?? null;
  const intent = showingDemo ? "" : live?.callerIntent ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={pageEyebrow}>Right now</p>
          <h1 className={pageTitle}>Live</h1>
        </div>
        <DemoToggle running={demo.running} onToggle={demo.toggle} />
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <section className={`${cardClass} bg-base-100`}>
          <div className="card-body items-center text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-base-content/60">
              {showingDemo || showingLive ? "Incoming" : "All quiet"}
            </p>
            <h2 className="font-display card-title text-2xl">{callerName}</h2>
            <p className="text-base text-base-content/70">
              {callerNumber ? formatPhone(callerNumber) : "Sift will pick up when someone calls."}
            </p>
            {(showingDemo || showingLive) && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <NameCheck match={targetMatch} />
                {claimedTarget ? (
                  <span className="badge badge-neutral badge-soft">Asking for {claimedTarget}</span>
                ) : null}
              </div>
            )}
            {intent ? <p className="max-w-sm text-base text-base-content/70">{intent}</p> : null}
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

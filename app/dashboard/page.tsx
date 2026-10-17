"use client";

import { ActionBadge, badgeForCall } from "@/components/action-badge";
import { CallStrip } from "@/components/call-strip";
import { DemoToggle } from "@/components/demo-toggle";
import { formatPhone } from "@/components/format";
import { LiveTranscript } from "@/components/live-transcript";
import { RiskGauge } from "@/components/risk-gauge";
import { useSiftDirectory } from "@/components/sift-provider";
import { cardClass } from "@/components/styles";
import { useDemoPlayback } from "@/components/use-demo-playback";
import type { RoutingStatus, TranscriptLine } from "@/lib/mockCallData";

function NameCheck({ match }: { match: boolean | null }) {
  if (match === true) {
    return (
      <span className="rounded-full bg-emerald-400 px-3 py-1 text-sm font-semibold text-emerald-950">
        Name check: match
      </span>
    );
  }
  if (match === false) {
    return (
      <span className="rounded-full bg-rose-400 px-3 py-1 text-sm font-semibold text-rose-950">
        Name check: mismatch
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
      Name check: still listening
    </span>
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
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Right now</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Live</h1>
        </div>
        <DemoToggle running={demo.running} onToggle={demo.toggle} />
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className={`${cardClass} flex flex-col items-center px-6 py-8 text-center`}>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            {showingDemo || showingLive ? "Incoming" : "All quiet"}
          </p>
          <h2 className="font-display mt-2 text-3xl font-extrabold">{callerName}</h2>
          <p className="mt-1 text-slate-500">
            {callerNumber ? formatPhone(callerNumber) : "Sift will pick up when someone calls."}
          </p>
          {(showingDemo || showingLive) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <NameCheck match={targetMatch} />
              {claimedTarget ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  Asking for {claimedTarget}
                </span>
              ) : null}
            </div>
          )}
          {intent ? <p className="mt-3 max-w-sm text-sm text-slate-500">{intent}</p> : null}
          <div className="my-6">
            <RiskGauge score={score} />
          </div>
          <ActionBadge status={status} />
          {reasons.length > 0 ? (
            <ul className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
              {reasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-600"
                >
                  {reason}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <LiveTranscript lines={lines} />
      </div>
      <CallStrip calls={calls} />
    </div>
  );
}

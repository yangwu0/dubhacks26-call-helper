"use client";

import Link from "next/link";
import { Moon } from "lucide-react";
import { ActionBadge, badgeForCall } from "@/components/action-badge";
import { formatPhone, formatSaved, minutesBetween } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { useSiftDirectory } from "@/components/sift-provider";
import { metaMuted, riskPill } from "@/components/styles";
import type { CallRecord } from "@/lib/mockCallData";

function liveCallFrom(calls: CallRecord[]): CallRecord | null {
  const live = calls.filter((call) => call.status === "in_progress");
  if (live.length === 0) return null;
  return live.reduce((latest, call) =>
    new Date(call.startedAt).getTime() > new Date(latest.startedAt).getTime()
      ? call
      : latest,
  );
}

type Stats = {
  callsHandled: number;
  scamsBlocked: number;
  minutesSaved: number;
};

function statsFromCalls(calls: CallRecord[]): Stats {
  const times = calls
    .map((call) => new Date(call.startedAt).getTime())
    .filter((time) => !Number.isNaN(time));
  const latest = times.length > 0 ? Math.max(...times) : 0;
  const cutoff = latest - 7 * 24 * 60 * 60 * 1000;
  const pool = calls.filter((call) => {
    const time = new Date(call.startedAt).getTime();
    return !Number.isNaN(time) && time >= cutoff;
  });
  return {
    callsHandled: pool.length,
    scamsBlocked: pool.filter(
      (call) => call.action === "blocked" || call.classification === "scam",
    ).length,
    minutesSaved: pool.reduce(
      (sum, call) => sum + minutesBetween(call.startedAt, call.endedAt),
      0,
    ),
  };
}

export default function DashboardPage() {
  const { calls, owner, setDndOn } = useSiftDirectory();
  const available = !owner.isDndOn;
  const stats = statsFromCalls(calls);
  const liveCall = liveCallFrom(calls);
  const tiles = [
    { label: "calls", value: String(stats.callsHandled) },
    { label: "blocked", value: String(stats.scamsBlocked) },
    { label: "time saved", value: formatSaved(stats.minutesSaved) },
  ];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="stats w-full bg-base-200 shadow-none">
            <div className="stat gap-0 px-2 py-2.5 text-center">
              <div className="stat-title text-[0.7rem] font-medium normal-case leading-tight text-base-content/60">
                {tile.label}
              </div>
              <div className="stat-value text-xl font-semibold leading-tight text-base-content sm:text-2xl">
                {tile.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {liveCall ? (
        <Link
          href={`/dashboard/calls/${liveCall.id}`}
          className="mt-2 block rounded-box bg-base-200 px-4 py-3 no-underline transition-colors hover:bg-base-300/70"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-base-content">
                {liveCall.callerName.trim() ||
                  formatPhone(liveCall.callerNumber) ||
                  "Caller"}
              </p>
              <p className={metaMuted}>{formatPhone(liveCall.callerNumber)}</p>
            </div>
            <span className={riskPill[riskTone(liveCall.riskScore)]}>{liveCall.riskScore}</span>
          </div>
          <div className="mt-2">
            <ActionBadge status={badgeForCall(liveCall)} />
          </div>
          {liveCall.riskReasons[0] ? (
            <p className={`mt-2 truncate ${metaMuted}`}>{liveCall.riskReasons[0]}</p>
          ) : null}
        </Link>
      ) : (
        <div
          className="mt-2 rounded-box bg-base-200/80 px-4 py-3 text-center text-sm text-base-content/55"
          aria-live="polite"
        >
          No current live call
        </div>
      )}

      <button
        type="button"
        aria-pressed={available}
          onClick={() => {
            void setDndOn(available);
          }}
        className={`btn btn-circle fixed bottom-[calc(5rem+max(0.75rem,env(safe-area-inset-bottom)))] left-1/2 z-20 flex h-[75vw]! max-h-[18rem]! w-[75vw]! max-w-[18rem]! -translate-x-1/2 flex-col gap-1 overflow-hidden border-0 transition-[transform,box-shadow] duration-200 ease-out active:scale-[0.97] ${
          available
            ? "bg-primary! text-primary-content! shadow-[0_14px_32px_-10px_rgba(28,43,30,0.55),0_4px_10px_-2px_rgba(28,43,30,0.25)] hover:bg-primary! hover:shadow-[0_18px_36px_-10px_rgba(28,43,30,0.6),0_6px_12px_-2px_rgba(28,43,30,0.28)]"
            : "bg-base-300! text-base-content! shadow-[0_12px_28px_-10px_rgba(28,43,30,0.28),0_3px_8px_-2px_rgba(28,43,30,0.12)] hover:bg-base-300! hover:shadow-[0_16px_32px_-10px_rgba(28,43,30,0.32),0_5px_10px_-2px_rgba(28,43,30,0.16)]"
        }`}
      >
        {!available ? (
          <Moon
            aria-hidden
            strokeWidth={1.25}
            className="pointer-events-none absolute size-[55%] text-base-content/20"
          />
        ) : null}
        <span
          className={`relative text-2xl font-semibold sm:text-3xl ${
            available
              ? ""
              : "[text-shadow:0_1px_3px_rgba(28,43,30,0.55),0_0_8px_rgba(220,232,222,0.65)]"
          }`}
        >
          {available ? "Available" : "Do not disturb"}
        </span>
        <span
          className={`relative max-w-[12rem] text-sm font-normal whitespace-normal opacity-80 sm:text-base ${
            available
              ? ""
              : "[text-shadow:0_1px_2px_rgba(28,43,30,0.45),0_0_6px_rgba(220,232,222,0.55)]"
          }`}
        >
          {available ? "Calls come to you" : "Sift answers the calls"}
        </span>
      </button>
    </div>
  );
}

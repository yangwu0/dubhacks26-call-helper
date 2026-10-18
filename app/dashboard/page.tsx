"use client";

import { useState } from "react";
import { formatSaved, minutesBetween } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";
import type { CallRecord } from "@/lib/mockCallData";

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
  const { calls } = useSiftDirectory();
  const [available, setAvailable] = useState(true);
  const stats = statsFromCalls(calls);
  const tiles = [
    { label: "calls", value: String(stats.callsHandled) },
    { label: "blocked", value: String(stats.scamsBlocked) },
    { label: "time saved", value: formatSaved(stats.minutesSaved) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-3xl">
      <div className="grid gap-4 lg:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="stats w-full bg-base-200 shadow-none">
            <div className="stat px-4 py-3">
              <div className="stat-title text-sm font-medium normal-case text-base-content/60">
                {tile.label}
              </div>
              <div className="stat-value text-3xl font-semibold text-base-content">{tile.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-8 md:pt-4">
        <button
          type="button"
          aria-pressed={available}
          onClick={() => setAvailable((current) => !current)}
          className={`btn btn-circle flex h-[min(78vw,20rem)]! w-[min(78vw,20rem)]! flex-col gap-1 border-0 shadow-lg ${
            available
              ? "bg-primary! text-primary-content! hover:bg-primary!"
              : "bg-base-300! text-base-content! hover:bg-base-300!"
          }`}
        >
          <span className="text-2xl font-semibold">
            {available ? "Available" : "Do not disturb"}
          </span>
          <span className="max-w-[12rem] text-sm font-normal whitespace-normal opacity-80">
            {available ? "Calls come to you" : "Sift holds the calls"}
          </span>
        </button>
      </div>
    </div>
  );
}

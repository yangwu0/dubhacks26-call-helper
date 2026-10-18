"use client";

import { useState } from "react";
import { formatSaved, minutesBetween } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";
import { cardClass } from "@/components/styles";
import type { CallRecord } from "@/lib/mockCallData";

function tally(calls: CallRecord[]) {
  return {
    calls: calls.length,
    blocked: calls.filter((call) => call.action === "blocked" || call.classification === "scam").length,
    minutes: calls.reduce((sum, call) => sum + minutesBetween(call.startedAt, call.endedAt), 0),
  };
}

export default function DashboardPage() {
  const { calls } = useSiftDirectory();
  const [available, setAvailable] = useState(true);
  const stats = tally(calls);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 py-4 md:justify-center md:gap-16 md:py-10">
      <section className="order-1 flex w-full flex-col gap-3 md:order-2 md:grid md:grid-cols-3 md:gap-4">
        {[
          { label: "calls", value: String(stats.calls) },
          { label: "blocked", value: String(stats.blocked) },
          { label: "time saved", value: formatSaved(stats.minutes) },
        ].map((item) => (
          <article key={item.label} className={cardClass}>
            <div className="card-body items-start gap-1 px-4 py-3 text-left md:items-center md:p-5 md:text-center">
              <p className="text-sm font-medium text-base-content/55">{item.label}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">{item.value}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="order-2 flex w-full flex-1 items-center justify-center md:order-1 md:w-auto md:flex-none">
      <button
        type="button"
        aria-pressed={available}
        onClick={() => setAvailable((current) => !current)}
        className={`flex size-64 flex-col items-center justify-center gap-2 rounded-full px-8 text-center md:size-80 ${
          available
            ? "bg-primary text-primary-content shadow-[0_8px_30px_rgb(28,43,30,0.22)]"
            : "sift-elevate bg-base-200 text-base-content"
        }`}
      >
        <span className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {available ? "Available" : "Busy"}
        </span>
        <span className="max-w-40 text-sm leading-snug opacity-80">
          {available ? "Calls come to you" : "Do not disturb"}
        </span>
      </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { actionText, formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { cardClass } from "@/components/styles";
import type { CallRecord } from "@/lib/mockCallData";

const TONE_CLASS = {
  safe: "bg-emerald-400 text-emerald-950",
  warn: "bg-amber-400 text-amber-950",
  scam: "bg-rose-400 text-rose-950",
} as const;

export function CallStrip({ calls }: { calls: CallRecord[] }) {
  const recent = calls.slice(0, 5);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-extrabold">Last 5 calls</h2>
        <Link href="/dashboard/calls" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          See the log
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className={`${cardClass} px-5 py-6 text-slate-500`}>No calls yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {recent.map((call) => {
            const tone = riskTone(call.riskScore);
            return (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className={`${cardClass} block px-4 py-4 transition hover:-translate-y-0.5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{call.callerName || "Unknown"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE_CLASS[tone]}`}>
                    {call.riskScore}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{formatPhone(call.callerNumber)}</p>
                <p className="mt-3 text-xs font-medium text-slate-400">
                  {actionText(call.action, call.status)} · {formatWhen(call.startedAt)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { actionText, formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { cardClass, riskPill } from "@/components/styles";
import type { CallRecord } from "@/lib/mockCallData";

export function CallStrip({ calls }: { calls: CallRecord[] }) {
  const recent = calls.slice(0, 5);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">Last 5 calls</h2>
        <Link href="/dashboard/calls" className="link link-primary text-sm font-semibold no-underline">
          See the log
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className={`${cardClass} card-body text-base-content/70`}>No calls yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {recent.map((call) => {
            const tone = riskTone(call.riskScore);
            return (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className={`${cardClass} card-compact transition hover:-translate-y-0.5 hover:shadow-lg`}
              >
                <div className="card-body">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-bold">{call.callerName || "Unknown"}</p>
                    <span className={riskPill[tone]}>{call.riskScore}</span>
                  </div>
                  <p className="truncate text-sm text-base-content/65">{formatPhone(call.callerNumber)}</p>
                  <p className="text-xs font-semibold text-base-content/55">
                    {actionText(call.action, call.status)} · {formatWhen(call.startedAt)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { actionText, formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { bodyMuted, cardClass, cardHeading, metaMuted, riskPill } from "@/components/styles";
import type { CallRecord } from "@/lib/mockCallData";

export function CallStrip({ calls }: { calls: CallRecord[] }) {
  const recent = calls.slice(0, 5);

  return (
    <section className={cardClass}>
      <div className="card-body gap-2 p-2 sm:p-3">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
          <h2 className={cardHeading}>Recent calls</h2>
          <Link href="/dashboard/calls" className={`link link-primary ${metaMuted} font-semibold no-underline`}>
            Full log
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className={`px-4 py-6 ${bodyMuted}`}>No calls yet.</p>
        ) : (
          <ul>
            {recent.map((call) => {
              const tone = riskTone(call.riskScore);
              return (
                <li key={call.id}>
                  <Link
                    href={`/dashboard/calls/${call.id}`}
                    className="flex items-center gap-4 rounded-2xl px-4 py-3 hover:bg-base-100"
                  >
                    <span className={`${riskPill[tone]} min-w-12 justify-center`}>{call.riskScore}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{call.callerName || "Unknown"}</span>
                      <span className={`block truncate ${metaMuted}`}>{formatPhone(call.callerNumber)}</span>
                    </span>
                    <span className={`hidden shrink-0 sm:block ${metaMuted}`}>
                      {actionText(call.action, call.status)}
                    </span>
                    <span className={`shrink-0 ${metaMuted}`}>{formatWhen(call.startedAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

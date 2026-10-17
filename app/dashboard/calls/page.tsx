"use client";

import Link from "next/link";
import { actionText, formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { useSiftDirectory } from "@/components/sift-provider";
import { cardClass } from "@/components/styles";

const TONE_CLASS = {
  safe: "bg-emerald-400 text-emerald-950",
  warn: "bg-amber-400 text-amber-950",
  scam: "bg-rose-400 text-rose-950",
} as const;

export default function CallsPage() {
  const { calls, usingSample } = useSiftDirectory();

  return (
    <div>
      <p className="text-sm font-medium text-slate-500">The log</p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Calls</h1>
      <p className="mt-2 text-slate-500">
        {usingSample ? "Sample calls, ready for the demo." : "Updating from your line."}
      </p>
      <div className={`${cardClass} mt-6 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4 font-semibold">When</th>
                <th className="px-5 py-4 font-semibold">Caller</th>
                <th className="px-5 py-4 font-semibold">Number</th>
                <th className="px-5 py-4 font-semibold">Name check</th>
                <th className="px-5 py-4 font-semibold">Risk</th>
                <th className="px-5 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-slate-500">
                    No calls yet.
                  </td>
                </tr>
              ) : (
                calls.map((call) => {
                  const tone = riskTone(call.riskScore);
                  return (
                    <tr key={call.id} className="border-t border-slate-100">
                      <td className="px-5 py-4 text-slate-500">{formatWhen(call.startedAt)}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/calls/${call.id}`}
                          className="font-semibold text-slate-800 hover:text-emerald-700"
                        >
                          {call.callerName || "Unknown"}
                        </Link>
                        <p className="text-sm text-slate-500">{call.callerIntent}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatPhone(call.callerNumber)}</td>
                      <td className="px-5 py-4">
                        {call.targetMatch === true
                          ? "Match"
                          : call.targetMatch === false
                            ? "Mismatch"
                            : "Unknown"}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONE_CLASS[tone]}`}>
                          {call.riskScore}
                        </span>
                      </td>
                      <td className="px-5 py-4">{actionText(call.action, call.status)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

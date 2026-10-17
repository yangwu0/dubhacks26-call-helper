"use client";

import Link from "next/link";
import { actionText, formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { useSiftDirectory } from "@/components/sift-provider";
import { bodyMuted, cardClass, pageEyebrow, pageTitle, riskPill } from "@/components/styles";

export default function CallsPage() {
  const { calls, usingSample } = useSiftDirectory();

  return (
    <div>
      <p className={pageEyebrow}>The log</p>
      <h1 className={pageTitle}>Calls</h1>
      <p className={`mt-2 ${bodyMuted}`}>
        {usingSample ? "Sample calls, ready for the demo." : "Updating from your line."}
      </p>
      <div className={`${cardClass} mt-6`}>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-base-content/60">
                  <th>When</th>
                  <th>Caller</th>
                  <th>Number</th>
                  <th>Name check</th>
                  <th>Risk</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-base-content/65">
                      No calls yet.
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => {
                    const tone = riskTone(call.riskScore);
                    return (
                      <tr key={call.id} className="hover">
                        <td className="text-base-content/70">{formatWhen(call.startedAt)}</td>
                        <td>
                          <Link
                            href={`/dashboard/calls/${call.id}`}
                            className="link link-hover font-bold no-underline"
                          >
                            {call.callerName || "Unknown"}
                          </Link>
                          <p className="text-sm text-base-content/65">{call.callerIntent}</p>
                        </td>
                        <td className="text-base-content/70">{formatPhone(call.callerNumber)}</td>
                        <td>
                          {call.targetMatch === true
                            ? "Match"
                            : call.targetMatch === false
                              ? "Mismatch"
                              : "Unknown"}
                        </td>
                        <td>
                          <span className={riskPill[tone]}>{call.riskScore}</span>
                        </td>
                        <td>{actionText(call.action, call.status)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

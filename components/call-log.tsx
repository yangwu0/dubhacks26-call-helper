"use client";

import Link from "next/link";
import { actionText, formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { useSiftDirectory } from "@/components/sift-provider";
import {
  cardClass,
  labelCaps,
  metaMuted,
  pageSubtitle,
  pageTitle,
  riskPill,
} from "@/components/styles";

export function CallLog() {
  const { calls } = useSiftDirectory();

  return (
    <div>
      <h1 className={pageTitle}>Log</h1>
      <p className={pageSubtitle}>Calls Sift screened for you.</p>
      <ul className="mt-6 flex flex-col gap-3 md:hidden">
        {calls.length === 0 ? (
          <li className="rounded-box bg-base-200 px-4 py-8 text-base-content/65">
            No calls yet.
          </li>
        ) : (
          calls.map((call) => {
            const tone = riskTone(call.riskScore);
            return (
              <li key={call.id}>
                <Link href={`/dashboard/calls/${call.id}`} className="block rounded-box bg-base-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {call.callerName.trim() || formatPhone(call.callerNumber) || "Caller"}
                      </p>
                      <p className={metaMuted}>{formatPhone(call.callerNumber)}</p>
                    </div>
                    <span className={riskPill[tone]}>{call.riskScore}</span>
                  </div>
                  <p className={`mt-2 ${metaMuted}`}>
                    {actionText(call.action, call.status)} · {formatWhen(call.startedAt)}
                  </p>
                  {call.summary ? <p className={`mt-1 truncate ${metaMuted}`}>{call.summary}</p> : null}
                </Link>
              </li>
            );
          })
        )}
      </ul>
      <div className={`${cardClass} mt-6 hidden md:block`}>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th className={labelCaps}>When</th>
                  <th className={labelCaps}>Caller</th>
                  <th className={labelCaps}>Number</th>
                  <th className={labelCaps}>Name check</th>
                  <th className={labelCaps}>Risk</th>
                  <th className={labelCaps}>Action</th>
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
                            {call.callerName.trim() ||
                              formatPhone(call.callerNumber) ||
                              "Caller"}
                          </Link>
                          <p className={metaMuted}>{call.summary}</p>
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

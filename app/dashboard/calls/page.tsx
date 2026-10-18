"use client";

import Link from "next/link";
import { actionText, formatPhone, formatWhen } from "@/components/format";
import { riskTone } from "@/components/risk-tone";
import { useSiftDirectory } from "@/components/sift-provider";
import { cardClass, metaMuted, riskPill } from "@/components/styles";

export default function CallsPage() {
  const { calls, usingSample } = useSiftDirectory();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <p className={metaMuted}>
        {usingSample ? "Sample calls, ready for the demo." : "Every call Sift has handled."}
      </p>
      {calls.length === 0 ? (
        <div className={`${cardClass} card-body`}>No calls yet.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {calls.map((call) => {
            const tone = riskTone(call.riskScore);
            return (
              <li key={call.id}>
                <Link
                  href={`/dashboard/calls/${call.id}`}
                  className={`${cardClass} flex items-center gap-3 px-4 py-3 no-underline sm:gap-4 sm:px-5 sm:py-4`}
                >
                  <span className={`${riskPill[tone]} min-w-12 justify-center`}>{call.riskScore}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{call.callerName || "Unknown"}</span>
                    <span className={`block truncate ${metaMuted}`}>
                      {formatPhone(call.callerNumber)}
                      {call.callerIntent ? ` · ${call.callerIntent}` : ""}
                    </span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-sm font-medium">{actionText(call.action, call.status)}</span>
                    <span className={`block ${metaMuted}`}>{formatWhen(call.startedAt)}</span>
                  </span>
                  <span className={`shrink-0 sm:hidden ${metaMuted}`}>{formatWhen(call.startedAt)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

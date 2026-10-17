"use client";

import { useEffect, useState } from "react";
import { minutesBetween } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";
import { cardClass } from "@/components/styles";
import { REPORT_PLACEHOLDER, type CallRecord } from "@/lib/mockCallData";

type Stats = {
  callsHandled: number;
  scamsBlocked: number;
  meetingsBooked: number;
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
    meetingsBooked: pool.filter((call) => call.action === "booked").length,
    minutesSaved: pool.reduce(
      (sum, call) => sum + minutesBetween(call.startedAt, call.endedAt),
      0,
    ),
  };
}

function numberFrom(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export default function ReportPage() {
  const { calls } = useSiftDirectory();
  const [apiStats, setApiStats] = useState<Stats | null>(null);
  const [paragraph, setParagraph] = useState(REPORT_PLACEHOLDER);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState("");
  const stats = apiStats ?? statsFromCalls(calls);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/report/weekly");
        if (!response.ok) return;
        const json: unknown = await response.json();
        if (!json || typeof json !== "object" || cancelled) return;
        const record = json as Record<string, unknown>;
        const nextParagraph = ["paragraph", "summary", "narrative", "text"]
          .map((key) => record[key])
          .find((value) => typeof value === "string" && value.trim().length > 0 && value !== "Not implemented");
        const callsHandled = numberFrom(record, ["calls_handled", "callsHandled"]);
        const scamsBlocked = numberFrom(record, ["scams_blocked", "scamsBlocked"]);
        const meetingsBooked = numberFrom(record, ["meetings_booked", "meetingsBooked"]);
        const minutesSaved = numberFrom(record, ["minutes_saved", "minutesSaved"]);
        if (
          callsHandled !== null &&
          scamsBlocked !== null &&
          meetingsBooked !== null &&
          minutesSaved !== null
        ) {
          setApiStats({ callsHandled, scamsBlocked, meetingsBooked, minutesSaved });
        }
        if (typeof nextParagraph === "string") setParagraph(nextParagraph);
      } catch {
        // The report route can be offline. The placeholder stays.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendReport() {
    setSending(true);
    setSendNote("");
    try {
      const response = await fetch("/api/report/weekly", { method: "POST" });
      setSendNote(response.ok ? "Sent to your phone." : "The report is not ready to send yet.");
    } catch {
      setSendNote("The report is not ready to send yet.");
    } finally {
      setSending(false);
    }
  }

  const tiles = [
    { label: "Calls handled", value: stats.callsHandled },
    { label: "Scams blocked", value: stats.scamsBlocked },
    { label: "Meetings booked", value: stats.meetingsBooked },
    { label: "Minutes saved", value: stats.minutesSaved },
  ];

  return (
    <div>
      <p className="text-sm font-medium text-slate-500">This week</p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Report</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <article key={tile.label} className={`${cardClass} px-5 py-5`}>
            <p className="text-sm font-medium text-slate-500">{tile.label}</p>
            <p className="font-display mt-2 text-5xl font-extrabold tracking-tight">{tile.value}</p>
          </article>
        ))}
      </div>
      <section className={`${cardClass} mt-5 px-6 py-6`}>
        <h2 className="font-display text-2xl font-extrabold">The note</h2>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-600">{paragraph}</p>
        <button
          type="button"
          onClick={sendReport}
          disabled={sending}
          className="mt-6 rounded-3xl bg-emerald-400 px-5 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send report to my phone"}
        </button>
        {sendNote ? <p className="mt-3 text-sm text-slate-500">{sendNote}</p> : null}
      </section>
    </div>
  );
}

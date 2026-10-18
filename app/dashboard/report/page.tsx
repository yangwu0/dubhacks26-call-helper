"use client";

import { useEffect, useState } from "react";
import { minutesBetween } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
import {
  bodyMuted,
  btnPrimary,
  cardClass,
  metaMuted,
  pageEyebrow,
  pageTitle,
  sectionTitle,
} from "@/components/styles";
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

async function authHeaders(): Promise<HeadersInit> {
  const supabase = getOptionalBrowserClient();
  const session = supabase ? await supabase.auth.getSession() : null;
  const token = session?.data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
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
        const response = await fetch("/api/report/weekly", {
          headers: await authHeaders(),
        });
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
      const response = await fetch("/api/report/weekly", {
        method: "POST",
        headers: await authHeaders(),
      });
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
      <p className={pageEyebrow}>This week</p>
      <h1 className={pageTitle}>Report</h1>
      <div className="stats stats-vertical mt-6 w-full shadow-md sm:stats-horizontal">
        {tiles.map((tile) => (
          <div key={tile.label} className="stat bg-base-100">
            <div className="stat-title font-semibold">{tile.label}</div>
            <div className="stat-value font-display text-3xl text-primary">{tile.value}</div>
          </div>
        ))}
      </div>
      <section className={`${cardClass} mt-5`}>
        <div className="card-body">
          <h2 className={sectionTitle}>The note</h2>
          <p className={`max-w-3xl ${bodyMuted}`}>{paragraph}</p>
          <div className="card-actions mt-4 justify-start">
            <button type="button" onClick={sendReport} disabled={sending} className={btnPrimary}>
              {sending ? "Sending…" : "Send report to my phone"}
            </button>
          </div>
          {sendNote ? <p className={metaMuted}>{sendNote}</p> : null}
        </div>
      </section>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/mockCallData";
import { cardClass } from "@/components/styles";

const RISKY_SOURCE =
  "gift cards?|arrest(?:ed)?|\\birs\\b|warrant|social security|bitcoin|wire transfer|remote[- ]access";

function highlight(text: string) {
  const pattern = new RegExp(RISKY_SOURCE, "gi");
  const parts: Array<{ text: string; risky: boolean; key: string }> = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ text: text.slice(last, start), risky: false, key: `t-${last}` });
    }
    parts.push({ text: match[0], risky: true, key: `r-${start}` });
    last = start + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), risky: false, key: `t-${last}` });
  }
  return parts;
}

function hasRisk(text: string) {
  return new RegExp(RISKY_SOURCE, "i").test(text);
}

export function LiveTranscript({ lines }: { lines: TranscriptLine[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <section className={`${cardClass} flex h-[min(560px,calc(100vh-18rem))] min-h-[360px] flex-col`}>
      <header className="flex items-center justify-between px-6 pt-6">
        <div>
          <p className="text-sm text-slate-500">Conversation</p>
          <h2 className="font-display text-2xl font-extrabold">Live transcript</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {lines.length === 0 ? "Waiting" : `${lines.length} lines`}
        </span>
      </header>
      <div
        ref={scroller}
        className="sift-scroll mt-4 flex-1 space-y-3 overflow-y-auto px-6 pb-6"
        aria-live="polite"
      >
        {lines.length === 0 ? (
          <p className="rounded-3xl bg-slate-50 px-5 py-8 text-center text-slate-500">
            The conversation will appear here, one line at a time.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {lines.map((line) => {
              const risky = line.role === "caller" && hasRisk(line.text);
              return (
                <motion.article
                  key={line.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className={`max-w-[95%] rounded-3xl px-4 py-3 ${
                    line.role === "agent"
                      ? "bg-slate-50"
                      : risky
                        ? "ml-auto border border-rose-200 bg-rose-50"
                        : "ml-auto border border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {line.role === "agent" ? "Sift" : "Caller"}
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-800">
                    {highlight(line.text).map((part) =>
                      part.risky ? (
                        <mark
                          key={part.key}
                          className="rounded-md bg-rose-100 px-1 text-rose-700"
                        >
                          {part.text}
                        </mark>
                      ) : (
                        <span key={part.key}>{part.text}</span>
                      ),
                    )}
                  </p>
                </motion.article>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

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
    <section
      className={`${cardClass} flex h-[min(480px,calc(100vh-16rem))] min-h-[300px] flex-col`}
    >
      <div className="card-body flex min-h-0 flex-1 flex-col pb-2 pt-6">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-base-content/60">Conversation</p>
            <h2 className="font-display text-xl font-bold">Live transcript</h2>
          </div>
          <span className="badge badge-neutral badge-soft font-bold">
            {lines.length === 0 ? "Waiting" : `${lines.length} lines`}
          </span>
        </div>
        <div
          ref={scroller}
          className="sift-scroll mt-4 flex-1 space-y-3 overflow-y-auto pr-1"
          aria-live="polite"
        >
          {lines.length === 0 ? (
            <p className="rounded-box bg-base-200/70 px-5 py-10 text-center text-base-content/65">
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
                    className={`chat ${line.role === "agent" ? "chat-start" : "chat-end"} max-w-[95%]`}
                  >
                    <div className="chat-header text-xs font-bold uppercase tracking-wide opacity-70">
                      {line.role === "agent" ? "Sift" : "Caller"}
                    </div>
                    <div
                      className={`chat-bubble text-base leading-relaxed ${
                        line.role === "agent"
                          ? "chat-bubble-secondary"
                          : risky
                            ? "chat-bubble-error"
                            : "chat-bubble-primary"
                      }`}
                    >
                      {highlight(line.text).map((part) =>
                        part.risky ? (
                          <mark key={part.key} className="rounded-md bg-error/20 font-semibold text-error">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={part.key}>{part.text}</span>
                        ),
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </section>
  );
}

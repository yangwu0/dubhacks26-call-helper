"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { RoutingStatus } from "@/lib/mockCallData";

const LABEL: Record<RoutingStatus, string> = {
  waiting: "Waiting",
  screening: "Screening",
  forwarding: "Forwarding",
  blocked: "Blocked",
  message_taken: "Message taken",
};

const STYLE: Record<RoutingStatus, string> = {
  waiting: "bg-slate-100 text-slate-600",
  screening: "bg-emerald-400 text-emerald-950",
  forwarding: "bg-emerald-400 text-emerald-950",
  blocked: "bg-rose-400 text-rose-950",
  message_taken: "bg-amber-400 text-amber-950",
};

export function badgeForCall(call: {
  status: string;
  action: string;
}): RoutingStatus {
  if (call.action === "blocked") return "blocked";
  if (call.action === "forwarded" || call.action === "booked") return "forwarding";
  if (call.action === "message_taken") return "message_taken";
  if (call.status === "in_progress") return "screening";
  return "waiting";
}

export function ActionBadge({ status }: { status: RoutingStatus }) {
  const pulse = status === "screening" || status === "waiting";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${STYLE[status]}`}
      aria-live="polite"
    >
      <motion.span
        className="h-2 w-2 rounded-full bg-current"
        animate={pulse ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
        transition={pulse ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      />
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {LABEL[status]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

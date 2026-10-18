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
  waiting: "badge-neutral badge-soft",
  screening: "badge-success badge-soft",
  forwarding: "badge-success",
  blocked: "badge-error",
  message_taken: "badge-warning badge-soft",
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
  return (
    <div
      className={`badge badge-lg gap-2 rounded-full px-4 py-3 text-sm font-semibold ${STYLE[status]}`}
      aria-live="polite"
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {LABEL[status]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

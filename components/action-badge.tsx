"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { RoutingStatus } from "@/lib/mockCallData";

const LABEL: Record<RoutingStatus, string> = {
  waiting: "Waiting",
  screening: "Screening",
  forwarding: "Forwarding",
  blocked: "Blocked",
  message_taken: "Message taken",
  done: "Done",
};

const STYLE: Record<RoutingStatus, string> = {
  waiting: "badge-neutral badge-soft",
  screening: "badge-success badge-soft",
  forwarding: "badge-success",
  blocked: "badge-error",
  message_taken: "badge-warning badge-soft",
  done: "badge-neutral",
};

export function badgeForCall(call: {
  status: string;
  action: string;
}): RoutingStatus {
  if (call.action === "blocked") return "blocked";
  if (call.action === "forwarded" || call.action === "booked") return "forwarding";
  if (call.action === "message_taken") return "message_taken";
  if (call.status === "in_progress") return "screening";
  return "done";
}

export function ActionBadge({ status }: { status: RoutingStatus }) {
  const pulse = status === "screening" || status === "waiting";

  return (
    <div
      className={`badge badge-md gap-2 px-3 py-3 text-sm font-bold ${STYLE[status]}`}
      aria-live="polite"
    >
      <motion.span
        className="size-2 rounded-full bg-current"
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

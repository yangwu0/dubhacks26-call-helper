export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "Now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

export function minutesBetween(start: string, end: string | null): number {
  const started = new Date(start).getTime();
  const ended = end ? new Date(end).getTime() : started + 3 * 60 * 1000;
  if (Number.isNaN(started) || Number.isNaN(ended)) return 3;
  return Math.max(1, Math.round((ended - started) / 60000));
}

export function actionText(action: string, status: string): string {
  if (action === "blocked") return "Blocked";
  if (action === "forwarded") return "Forwarded";
  if (action === "message_taken") return "Message taken";
  if (action === "booked") return "Booked";
  if (status === "in_progress") return "Screening";
  return "Done";
}

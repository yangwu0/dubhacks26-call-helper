export const cardClass = "card card-border bg-base-100 shadow-sm";

/** Small label above the page h1 (e.g. “Right now”, “The log”). */
export const pageEyebrow = "text-sm font-semibold text-base-content/65";

export const pageTitle =
  "font-display mt-1.5 text-[1.85rem] font-bold leading-tight text-base-content sm:text-[2.05rem]";

/** One line under the page h1 (e.g. sample-data hint). */
export const pageSubtitle = "mt-2 text-base text-base-content/75 leading-relaxed";

export const sectionTitle = "font-display text-[1.35rem] font-bold text-base-content";

/** h2 inside cards (Owner, Live transcript, etc.). */
export const cardHeading = "font-display card-title text-xl font-bold text-base-content";

/** Main paragraph text in cards and summaries. */
export const bodyMuted = "text-base text-base-content/75 leading-relaxed";

/** Secondary line (table subtext, block reasons, footnotes). */
export const metaMuted = "text-sm text-base-content/65";

/** Uppercase labels in cards (Incoming, table headers). */
export const labelCaps = "text-xs font-semibold uppercase tracking-wide text-base-content/60";

export const btnPrimary = "btn btn-primary btn-md font-semibold";

export const btnDanger = "btn btn-error btn-md font-semibold";

export const btnSafe = "btn btn-success btn-md font-semibold";

export const inputClass = "input input-bordered input-md w-full bg-base-100 text-base";

export const riskPill = {
  safe: "badge badge-success badge-soft font-semibold",
  warn: "badge badge-warning badge-soft font-semibold",
  scam: "badge badge-error badge-soft font-semibold",
} as const;

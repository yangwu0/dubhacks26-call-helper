"use client";

export function DemoToggle({
  running,
  onToggle,
}: {
  running: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={running}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-400 opacity-70 transition hover:bg-white hover:text-slate-700 hover:opacity-100"
    >
      {running ? "Stop demo" : "Demo"}
    </button>
  );
}

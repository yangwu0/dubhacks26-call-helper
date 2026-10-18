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
      className={`btn btn-sm font-semibold ${running ? "btn-accent" : "btn-outline"}`}
    >
      {running ? "Stop simulation" : "Simulate scam call"}
    </button>
  );
}

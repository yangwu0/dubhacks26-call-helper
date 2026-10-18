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
      className={`btn btn-sm rounded-2xl font-semibold ${running ? "btn-primary" : "btn-outline border-base-300"}`}
    >
      {running ? "Stop simulation" : "Simulate scam call"}
    </button>
  );
}

"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`btn btn-ghost btn-sm gap-2 font-semibold ${className}`}
    >
      {theme === "dark" ? (
        <>
          <Sun className="size-4 text-warning" aria-hidden />
          Light
        </>
      ) : (
        <>
          <Moon className="size-4 text-primary" aria-hidden />
          Dark
        </>
      )}
    </button>
  );
}

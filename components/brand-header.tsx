import Link from "next/link";
import type { ReactNode } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** Shared top bar: logo size + inset match across welcome, login, and app chrome. */
export const brandHeaderPad =
  "px-5 pt-[max(1.25rem,env(safe-area-inset-top))]";

export function BrandHeader({
  href,
  end,
}: {
  href?: string;
  end?: ReactNode;
}) {
  const logo = <SiftLogo size="md" showWordmark className="font-display" />;

  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      {href ? (
        <Link href={href} className="no-underline">
          {logo}
        </Link>
      ) : (
        logo
      )}
      <div className="flex items-center gap-2">
        {end}
        <ThemeToggle className="bg-base-100/70 shadow-sm" />
      </div>
    </header>
  );
}

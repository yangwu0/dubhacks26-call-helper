"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Suspense, type ReactNode } from "react";
import { BrandHeader, brandHeaderPad } from "@/components/brand-header";
import { formatPhone } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";

const LINKS = [
  { href: "/dashboard/calls", label: "Log" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/settings", label: "Settings" },
];

function active(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavTabs({ pathname }: { pathname: string | null }) {
  const activeIndex = Math.max(
    0,
    LINKS.findIndex((link) => (pathname ? active(pathname, link.href) : false)),
  );

  return (
    <nav
      className="relative flex w-[min(100%,22rem)] items-center rounded-full border border-base-300/60 bg-base-200/90 p-1 shadow-sm"
      aria-label="Dashboard sections"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${LINKS.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {LINKS.map((link, itemIndex) => {
        const on = pathname ? active(pathname, link.href) : false;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={on ? "page" : undefined}
            className={`btn btn-ghost btn-sm relative z-10 h-9 min-h-9 flex-1 rounded-full border-0 bg-transparent px-2 text-center text-sm font-semibold no-underline hover:bg-transparent ${
              itemIndex === activeIndex ? "text-primary-content" : "text-base-content/80"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNav() {
  const pathname = usePathname();
  return <NavTabs pathname={pathname} />;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { owner } = useSiftDirectory();

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`mx-auto flex min-h-screen w-full max-w-6xl flex-col ${brandHeaderPad} pb-5 sm:px-6 lg:px-8`}
      >
        <header className="mb-8">
          <BrandHeader
            href="/dashboard"
            end={
              <span className="hidden text-xs text-base-content/70 md:inline">
                {owner.photonNumber
                  ? formatPhone(owner.photonNumber)
                  : owner.name || "Looking out for your line"}
              </span>
            }
          />
        </header>
        <main className="flex-1 pb-28">{children}</main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-base-100 from-80% to-transparent px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-center">
          <Suspense fallback={<NavTabs pathname={null} />}>
            <ActiveNav />
          </Suspense>
        </div>
      </div>
    </MotionConfig>
  );
}

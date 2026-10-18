"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Suspense, type ReactNode } from "react";
import { formatPhone } from "@/components/format";
import { SiftLogo } from "@/components/sift-logo";
import { useSiftDirectory } from "@/components/sift-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/", label: "Log" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/settings", label: "Settings" },
];

function active(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/dashboard/calls");
  }
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
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-6">
          <div className="navbar min-h-0 rounded-none border-0 bg-transparent px-0 py-1 shadow-none md:rounded-box md:border md:border-base-300/50 md:bg-base-100 md:px-2 md:py-1.5 md:shadow-sm">
            <div className="navbar-start">
              <Link href="/" className="flex items-center gap-2.5 px-1">
                <SiftLogo size="md" />
                <span>
                  <span className="font-display block text-lg font-bold leading-none">Sift</span>
                  <span className="mt-1 hidden text-xs text-base-content/70 md:block">
                    {owner.photonNumber
                      ? formatPhone(owner.photonNumber)
                      : owner.name || "Looking out for your line"}
                  </span>
                </span>
              </Link>
            </div>
            <div className="navbar-end">
              <ThemeToggle />
            </div>
          </div>
          <div className="hidden md:flex md:justify-center">
            <Suspense fallback={<NavTabs pathname={null} />}>
              <ActiveNav />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 pb-28 md:pb-6">{children}</main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-base-100 from-80% to-transparent px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex justify-center">
          <Suspense fallback={<NavTabs pathname={null} />}>
            <ActiveNav />
          </Suspense>
        </div>
      </div>
    </MotionConfig>
  );
}

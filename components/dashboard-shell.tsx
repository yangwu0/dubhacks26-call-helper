"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Suspense, type ReactNode } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/dashboard", label: "Live" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/report", label: "Report" },
  { href: "/dashboard/settings", label: "Settings" },
];

function active(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavTabs({ pathname }: { pathname: string | null }) {
  return (
    <nav
      className="inline-flex flex-nowrap gap-0.5 rounded-box border border-base-300/60 bg-base-200/80 p-1 shadow-sm"
      aria-label="Dashboard sections"
    >
      {LINKS.map((link) => {
        const on = pathname ? active(pathname, link.href) : false;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={on ? "page" : undefined}
            className={`btn btn-sm min-h-9 rounded-md px-3 text-sm font-semibold no-underline ${
              on ? "btn-primary" : "btn-ghost text-base-content/80 hover:bg-base-100"
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
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-4 space-y-3">
          <div className="navbar min-h-0 rounded-box border border-base-300/50 bg-base-100 px-2 py-1.5 shadow-sm">
            <div className="navbar-start">
              <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
                <SiftLogo size="md" />
                <span className="hidden sm:block">
                  <span className="font-display block text-lg font-bold leading-none">Sift</span>
                  <span className="text-xs text-base-content/70">Looking out for your line</span>
                </span>
              </Link>
            </div>
            <div className="navbar-end gap-0.5">
              <ThemeToggle />
              <Link href="/" className="btn btn-ghost btn-sm text-sm font-semibold">
                Sign out
              </Link>
            </div>
          </div>
          <div className="flex justify-center overflow-x-auto pb-0.5 sm:justify-start">
            <Suspense fallback={<NavTabs pathname={null} />}>
              <ActiveNav />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 pb-6">{children}</main>
      </div>
    </MotionConfig>
  );
}

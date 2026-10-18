"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";
import { Suspense, type ReactNode } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/dashboard/calls", label: "log" },
  { href: "/dashboard", label: "dashboard" },
  { href: "/dashboard/settings", label: "settings" },
];

function active(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavTabs({ pathname }: { pathname: string | null }) {
  return (
    <nav
      className="sift-elevate fixed bottom-4 left-1/2 z-20 grid w-[min(100%-2rem,24rem)] -translate-x-1/2 grid-cols-3 gap-1 rounded-full bg-base-200 p-1 md:static md:bottom-auto md:left-auto md:z-auto md:mx-auto md:mt-10 md:w-full md:max-w-md md:translate-x-0"
      aria-label="Sections"
    >
      {LINKS.map((link) => {
        const on = pathname ? active(pathname, link.href) : false;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={on ? "page" : undefined}
            className={`relative flex items-center justify-center rounded-full px-2 py-2 text-center text-sm font-medium no-underline ${
              on ? "text-primary-content" : "text-base-content/70"
            }`}
          >
            {on ? (
              <motion.span
                layoutId="sift-nav-tab"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative">{link.label}</span>
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
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pt-6 pb-28 sm:px-6 sm:pt-8 md:px-8 md:pt-12 md:pb-16">
        <header className="flex items-center justify-between md:sift-elevate md:rounded-3xl md:bg-base-200 md:px-4 md:py-2.5">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="Sift dashboard">
            <SiftLogo size="md" />
            <span className="font-display text-xl font-bold tracking-tight">Sift</span>
          </Link>
          <ThemeToggle />
        </header>
        <Suspense fallback={<NavTabs pathname={null} />}>
          <ActiveNav />
        </Suspense>
        <main className="mt-6 flex flex-1 flex-col md:mt-16">{children}</main>
      </div>
    </MotionConfig>
  );
}

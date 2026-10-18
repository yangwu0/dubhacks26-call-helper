"use client";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";
import { Suspense, type ReactNode } from "react";
import { formatPhone } from "@/components/format";
import { SiftLogo } from "@/components/sift-logo";
import { useSiftDirectory } from "@/components/sift-provider";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
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

function SignOut() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        const supabase = getOptionalBrowserClient();
        void supabase?.auth.signOut().finally(() => {
          router.replace("/");
        });
      }}
      className="btn btn-ghost btn-sm h-10 w-auto rounded-xl text-sm font-semibold"
    >
      Sign out
    </button>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { owner } = useSiftDirectory();

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-4 space-y-3">
          <div className="navbar min-h-0 rounded-box border border-base-300/50 bg-base-100 px-2 py-1.5 shadow-sm">
            <div className="navbar-start">
              <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
                <SiftLogo size="md" />
                <span className="hidden sm:block">
                  <span className="font-display block text-lg font-bold leading-none mt-2">Sift</span>
                  <span className="text-xs text-base-content/70">
                    {owner.siftNumber
                      ? formatPhone(owner.siftNumber)
                      : owner.name || "Looking out for your line"}
                  </span>
                </span>
              </Link>
            </div>
            <div className="navbar-end gap-2">
              <ThemeToggle />
              <SignOut />
            </div>
          </div>
          <div className="flex justify-center overflow-x-auto pb-0.5 sm:justify-start">
            <Suspense fallback={<NavTabs pathname={null} />}>
              <ActiveNav />
            </Suspense>
          </div>
        </header>
        <Suspense fallback={<NavTabs pathname={null} />}>
          <ActiveNav />
        </Suspense>
        <main className="mt-6 flex flex-1 flex-col md:mt-16">{children}</main>
      </div>
    </MotionConfig>
  );
}

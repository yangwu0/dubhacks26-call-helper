"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Suspense, type ReactNode } from "react";

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

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex items-center gap-1 rounded-3xl bg-slate-100/80 p-1">
      {LINKS.map((link) => {
        const on = pathname ? active(pathname, link.href) : false;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              on ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
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
  return <NavLinks pathname={pathname} />;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 py-5 sm:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400 font-display text-xl font-extrabold text-emerald-950">
              S
            </span>
            <span>
              <span className="block font-display text-xl font-extrabold leading-none">Sift</span>
              <span className="text-sm text-slate-500">Looking out for your line</span>
            </span>
          </Link>
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNav />
          </Suspense>
          <Link href="/" className="text-sm font-medium text-slate-400 hover:text-slate-700">
            Sign out
          </Link>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </MotionConfig>
  );
}

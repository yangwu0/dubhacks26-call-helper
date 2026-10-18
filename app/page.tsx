"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandHeader, brandHeaderPad } from "@/components/brand-header";
import { btnPrimary } from "@/components/styles";

export default function WelcomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,color-mix(in_oklab,var(--color-secondary)_45%,transparent),transparent_55%),linear-gradient(165deg,var(--color-base-100)_0%,var(--color-base-200)_48%,color-mix(in_oklab,var(--color-secondary)_28%,var(--color-base-100))_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55dvh] opacity-40 [background-image:repeating-linear-gradient(-12deg,transparent_0_14px,color-mix(in_oklab,var(--color-base-content)_6%,transparent)_14px_15px)]"
      />

      <div
        className={`relative z-10 flex flex-1 flex-col ${brandHeaderPad} pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
      >
        <BrandHeader />

        <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <motion.p
            className="font-display text-[clamp(3.25rem,14vw,4.5rem)] font-bold leading-[0.92] tracking-tight text-base-content"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            Sift
          </motion.p>
          <motion.h1
            className="mt-5 max-w-[18ch] text-2xl font-semibold leading-snug text-base-content/90"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
          >
            Someone to pick up, so you can stay present.
          </motion.h1>
          <motion.p
            className="mt-4 max-w-[32ch] text-base leading-relaxed text-base-content/70"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14, ease: "easeOut" }}
          >
            Sift answers unknown callers, watches for scams, and only brings you the calls that need you.
          </motion.p>
        </section>

        <motion.div
          className="mx-auto flex w-full max-w-md flex-col gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22, ease: "easeOut" }}
        >
          <Link
            href="/login?mode=signup"
            className={`${btnPrimary} btn-lg h-14 w-full text-base no-underline`}
          >
            Sign up
          </Link>
          <Link
            href="/login?mode=login"
            className="btn btn-ghost btn-lg h-12 w-full text-base font-semibold no-underline"
          >
            Log in
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

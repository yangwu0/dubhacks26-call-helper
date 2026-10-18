"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnPrimary, cardBodyClass, cardClass, inputClass, pageSubtitle, pageTitle } from "@/components/styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <main className="relative min-h-screen">
      <div className="absolute right-6 top-6 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-16 pt-20 lg:grid-cols-12 lg:px-10 lg:pt-24">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3">
            <SiftLogo size="md" />
            <span className="font-display text-xl font-bold tracking-tight">Sift</span>
          </div>
          <h1 className={`${pageTitle} mt-8`}>Someone calm on the line.</h1>
          <p className={pageSubtitle}>
            Sift answers unknown callers, watches for scams, and only brings you the calls that need you.
          </p>
        </div>
        <div className={`${cardClass} lg:col-span-6 lg:col-start-7`}>
          <form onSubmit={onSubmit} className={cardBodyClass}>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Sign in</h2>
            <fieldset className="fieldset gap-2">
              <legend className="fieldset-legend text-sm font-semibold text-base-content/70">Email</legend>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </fieldset>
            <fieldset className="fieldset gap-2">
              <legend className="fieldset-legend text-sm font-semibold text-base-content/70">
                Password
              </legend>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className={inputClass}
              />
            </fieldset>
            <button type="submit" className={`${btnPrimary} btn-block`}>
              Continue
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

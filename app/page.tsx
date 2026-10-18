"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnPrimary, cardBodyClass, cardClass, inputClass, pageSubtitle, pageTitle } from "@/components/styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const supabase = getOptionalBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, phone }),
      });
      const json: unknown = await response.json().catch(() => null);
      const message =
        json && typeof json === "object" && "error" in json && typeof json.error === "string"
          ? json.error
          : "";
      if (!response.ok) {
        setError(message || "Could not sign in.");
        return;
      }
      const tokens = json as {
        access_token?: string;
        refresh_token?: string;
        needs_phone?: boolean;
        phone_saved?: boolean;
      };
      if (!tokens.access_token || !tokens.refresh_token) {
        setError("Sign-in did not return a session.");
        return;
      }
      await supabase.auth.signOut({ scope: "local" });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      router.push(tokens.needs_phone || tokens.phone_saved ? "/dashboard/settings" : "/dashboard");
    } catch {
      setError("Could not reach Sift.");
    } finally {
      setPending(false);
    }
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
      </section>
      <section className="flex items-center justify-center bg-base-100 px-6 py-16">
        <div className="card card-border w-full max-w-md bg-base-100 shadow-xl">
          <form onSubmit={onSubmit} className="card-body gap-5">
            <div>
              <h2 className="font-display card-title text-2xl">Welcome back</h2>
              <p className="text-base-content/70">
                First time here creates your account. After that, the same email and password sign you back in.
              </p>
            </div>
            <fieldset className="fieldset">
              <legend className="fieldset-legend font-bold">Email</legend>
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

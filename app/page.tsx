"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnPrimary, inputClass } from "@/components/styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = getOptionalBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) router.replace("/dashboard");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

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
        body: JSON.stringify({ email, password }),
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
      const tokens = json as { access_token?: string; refresh_token?: string };
      if (!tokens.access_token || !tokens.refresh_token) {
        setError("Sign-in did not return a session.");
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Could not reach Sift.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle className="bg-base-100/80 shadow-sm" />
      </div>

      <section className="hero bg-base-200 px-6 py-12 sm:px-12 lg:px-16">
        <div className="hero-content w-full max-w-xl flex-col items-start p-0 text-left">
          <SiftLogo size="md" showWordmark className="font-display" />
          <div className="mt-10 space-y-4">
            <span className="badge badge-accent badge-outline badge-sm font-semibold">
              A gentler way to answer
            </span>
            <h1 className="font-display text-[1.75rem] font-bold leading-snug sm:text-[2rem]">
              Someone to pick up, so you can stay present.
            </h1>
            <p className="text-base leading-relaxed text-base-content/75">
              Sift answers unknown callers, watches for scams, and only brings you the calls that actually need you.
            </p>
          </div>
          <p className="mt-auto pt-16 text-base text-base-content/65">
            Your line stays yours. Sift just holds the door.
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
            <fieldset className="fieldset">
              <legend className="fieldset-legend font-bold">Password</legend>
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
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <button type="submit" disabled={pending} className={`${btnPrimary} btn-block mt-2`}>
              {pending ? "Signing in…" : "Continue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { BrandHeader, brandHeaderPad } from "@/components/brand-header";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
import { btnPrimary, inputClass } from "@/components/styles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signup = searchParams.get("mode") === "signup";
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
      const tokens = json as {
        access_token?: string;
        refresh_token?: string;
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
      router.push("/dashboard/calls");
    } catch {
      setError("Could not reach Sift.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main
      className={`relative flex h-dvh max-h-dvh flex-col overflow-hidden ${brandHeaderPad} pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
    >
      <BrandHeader href="/" />

      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-[clamp(0.5rem,2vh,1.5rem)]">
          <h1 className="font-display text-[clamp(1.5rem,5vh,1.875rem)] font-bold leading-tight">
            {signup ? "Create your account" : "Log in"}
          </h1>
          <p className="mt-[clamp(0.25rem,1.2vh,0.5rem)] text-[clamp(0.875rem,2.2vh,1rem)] leading-snug text-base-content/70">
            {signup
              ? "Use an email and password. You can add your phone so Sift can reach you on important calls."
              : "Welcome back. Use the same email and password you signed up with."}
          </p>

          <form
            onSubmit={onSubmit}
            className="mt-[clamp(0.75rem,3vh,1.75rem)] flex flex-col gap-[clamp(0.5rem,2vh,1rem)]"
          >
            <fieldset className="fieldset gap-2.5 p-0">
              <legend className="fieldset-legend pb-1.5 pt-0 font-bold">Email</legend>
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
            {signup ? (
              <fieldset className="fieldset gap-2.5 p-0">
                <legend className="fieldset-legend pb-1.5 pt-0 font-bold">Your phone</legend>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+12065550100"
                  className={inputClass}
                />
                <p className="text-xs leading-snug text-base-content/65 sm:text-sm">
                  Used when Sift needs to bridge you into a live call.
                </p>
              </fieldset>
            ) : null}
            <fieldset className="fieldset gap-2.5 p-0">
              <legend className="fieldset-legend pb-1.5 pt-0 font-bold">Password</legend>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className={inputClass}
              />
            </fieldset>
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className={`${btnPrimary} btn-lg h-[clamp(2.75rem,7vh,3.5rem)] min-h-11 w-full`}
            >
              {pending ? "Working…" : signup ? "Sign up" : "Log in"}
            </button>
          </form>
        </div>

        <p className="shrink-0 pt-[clamp(0.5rem,1.5vh,1rem)] pb-[clamp(0.75rem,2.5vh,1.5rem)] text-center text-sm text-base-content/65">
          {signup ? (
            <>
              Already have an account?{" "}
              <Link href="/login?mode=login" className="link link-hover font-semibold">
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/login?mode=signup" className="link link-hover font-semibold">
                Sign up
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center px-5">
          <p className="text-base-content/65">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

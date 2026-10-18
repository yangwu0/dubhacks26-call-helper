"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnPrimary, inputClass } from "@/components/styles";

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
      router.push("/");
    } catch {
      setError("Could not reach Sift.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-base-100 px-6 py-16">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle className="bg-base-100/80 shadow-sm" />
      </div>
      <div className="card card-border w-full max-w-md bg-base-100 shadow-xl">
        <form onSubmit={onSubmit} className="card-body gap-5">
          <div>
            <SiftLogo size="sm" showWordmark className="font-display" />
            <h2 className="font-display card-title mt-4 text-2xl">Sign in</h2>
            <p className="text-base-content/70">
              Debug builds auto-sign in on the home page. Use this only if you need another account.
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
            <legend className="fieldset-legend font-bold">Phone</legend>
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
    </main>
  );
}

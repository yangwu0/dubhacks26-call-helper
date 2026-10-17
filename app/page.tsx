"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SiftLogo } from "@/components/sift-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnPrimary, inputClass } from "@/components/styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
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
              <p className="text-base-content/70">Any email and password will do.</p>
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
            <button type="submit" className={`${btnPrimary} btn-block mt-2`}>
              Continue
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

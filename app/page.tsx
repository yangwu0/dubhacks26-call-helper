"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex flex-col justify-between bg-white px-8 py-10 sm:px-14 lg:px-16">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 font-display text-2xl font-extrabold text-emerald-950">
            S
          </span>
          <span className="font-display text-2xl font-extrabold">Sift</span>
        </div>
        <div className="max-w-xl py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            A gentler way to answer
          </p>
          <h1 className="font-display mt-4 text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-800 sm:text-6xl">
            Someone to pick up, so you can stay present.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-500">
            Sift answers unknown callers, watches for scams, and only brings you the calls that actually need you.
          </p>
        </div>
        <p className="text-sm text-slate-400">Your line stays yours. Sift just holds the door.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm shadow-slate-200/70"
        >
          <h2 className="font-display text-3xl font-extrabold">Welcome back</h2>
          <p className="mt-2 text-slate-500">Any email and password will do.</p>
          <label className="mt-8 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none ring-emerald-400/30 placeholder:text-slate-400 focus:bg-white focus:ring-4"
          />
          <label className="mt-5 block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none ring-emerald-400/30 placeholder:text-slate-400 focus:bg-white focus:ring-4"
          />
          <button
            type="submit"
            className="mt-8 w-full rounded-3xl bg-emerald-400 px-4 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-300"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatPhone } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";
import { cardClass } from "@/components/styles";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none ring-emerald-400/30 placeholder:text-slate-400 focus:bg-white focus:ring-4";

export default function SettingsPage() {
  const { owner, blocked, usingSample, saveOwner, addBlocked, removeBlocked } = useSiftDirectory();
  const [name, setName] = useState(owner.name);
  const [aliases, setAliases] = useState(owner.aliases);
  const [phone, setPhone] = useState(owner.phone);
  const [aliasDraft, setAliasDraft] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [note, setNote] = useState("");
  const dirty = useRef(false);

  useEffect(() => {
    if (dirty.current) return;
    setName(owner.name);
    setAliases(owner.aliases);
    setPhone(owner.phone);
  }, [owner]);

  function markDirty() {
    dirty.current = true;
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const result = await saveOwner({
      ...owner,
      name: name.trim() || owner.name,
      aliases,
      phone: phone.trim(),
    });
    setNote(result.message);
  }

  function addAlias() {
    const next = aliasDraft.trim();
    if (!next || aliases.includes(next)) return;
    markDirty();
    setAliases((current) => [...current, next]);
    setAliasDraft("");
  }

  async function onBlock(event: FormEvent) {
    event.preventDefault();
    const number = blockNumber.trim();
    if (!number) return;
    const result = await addBlocked(number, blockReason.trim() || "Blocked from settings");
    setNote(result.message);
    if (result.ok) {
      setBlockNumber("");
      setBlockReason("");
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-500">Your line</p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Settings</h1>
      <p className="mt-2 text-slate-500">
        {usingSample ? "Sample profile, until the directory connects." : "Connected to your directory."}
      </p>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <form onSubmit={onSave} className={`${cardClass} px-6 py-6`}>
          <h2 className="font-display text-2xl font-extrabold">Owner</h2>
          <label className="mt-5 block text-sm font-semibold" htmlFor="owner-name">
            Name
          </label>
          <input
            id="owner-name"
            value={name}
            onChange={(event) => {
              markDirty();
              setName(event.target.value);
            }}
            className={fieldClass}
          />
          <label className="mt-5 block text-sm font-semibold" htmlFor="owner-phone">
            Phone
          </label>
          <input
            id="owner-phone"
            value={phone}
            onChange={(event) => {
              markDirty();
              setPhone(event.target.value);
            }}
            placeholder="+12065550100"
            className={fieldClass}
          />
          <p className="mt-5 text-sm font-semibold">Aliases</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {aliases.map((alias) => (
              <button
                key={alias}
                type="button"
                onClick={() => {
                  markDirty();
                  setAliases((current) => current.filter((item) => item !== alias));
                }}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
              >
                {alias} ×
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={aliasDraft}
              onChange={(event) => setAliasDraft(event.target.value)}
              placeholder="Add an alias"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addAlias}
              className="mt-2 shrink-0 rounded-2xl bg-slate-100 px-4 font-semibold text-slate-700"
            >
              Add
            </button>
          </div>
          <button
            type="submit"
            className="mt-6 rounded-3xl bg-emerald-400 px-5 py-3 font-semibold text-emerald-950"
          >
            Save profile
          </button>
        </form>

        <section className={`${cardClass} px-6 py-6`}>
          <h2 className="font-display text-2xl font-extrabold">Blocked numbers</h2>
          <ul className="mt-4 space-y-3">
            {blocked.length === 0 ? (
              <li className="text-slate-500">Nothing is blocked.</li>
            ) : (
              blocked.map((item) => (
                <li
                  key={item.number}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{formatPhone(item.number)}</p>
                    <p className="text-sm text-slate-500">{item.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void removeBlocked(item.number).then((result) => setNote(result.message));
                    }}
                    className="rounded-2xl px-3 py-1 text-sm font-semibold text-rose-700"
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
          <form onSubmit={onBlock} className="mt-5">
            <label className="block text-sm font-semibold" htmlFor="block-number">
              Add a number
            </label>
            <input
              id="block-number"
              value={blockNumber}
              onChange={(event) => setBlockNumber(event.target.value)}
              placeholder="+18005550123"
              className={fieldClass}
            />
            <label className="mt-4 block text-sm font-semibold" htmlFor="block-reason">
              Reason
            </label>
            <input
              id="block-reason"
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="Why should Sift refuse this caller?"
              className={fieldClass}
            />
            <button
              type="submit"
              className="mt-5 rounded-3xl bg-rose-400 px-5 py-3 font-semibold text-rose-950"
            >
              Block number
            </button>
          </form>
        </section>
      </div>
      {note ? <p className="mt-4 text-sm text-slate-500">{note}</p> : null}
    </div>
  );
}

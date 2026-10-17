"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatPhone } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";
import {
  btnDanger,
  btnPrimary,
  cardClass,
  cardHeading,
  inputClass,
  metaMuted,
  pageEyebrow,
  pageSubtitle,
  pageTitle,
} from "@/components/styles";

export default function SettingsPage() {
  const { owner, blocked, saveOwner, addBlocked, removeBlocked } = useSiftDirectory();
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
      <p className={pageEyebrow}>Your line</p>
      <h1 className={pageTitle}>Settings</h1>
      <p className={pageSubtitle}>
        Connected to your account. Changes here are saved in Supabase.
      </p>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <form onSubmit={onSave} className={cardClass}>
          <div className="card-body gap-4">
            <h2 className={cardHeading}>Owner</h2>
            <fieldset className="fieldset">
              <legend className="fieldset-legend font-bold">Name</legend>
              <input
                id="owner-name"
                value={name}
                onChange={(event) => {
                  markDirty();
                  setName(event.target.value);
                }}
                className={inputClass}
              />
            </fieldset>
            <fieldset className="fieldset">
              <legend className="fieldset-legend font-bold">Phone</legend>
              <input
                id="owner-phone"
                value={phone}
                onChange={(event) => {
                  markDirty();
                  setPhone(event.target.value);
                }}
                placeholder="+12065550100"
                className={inputClass}
              />
            </fieldset>
            <div>
              <p className="mb-2 font-bold">Aliases</p>
              <div className="flex flex-wrap gap-2">
                {aliases.map((alias) => (
                  <button
                    key={alias}
                    type="button"
                    onClick={() => {
                      markDirty();
                      setAliases((current) => current.filter((item) => item !== alias));
                    }}
                    className="badge badge-lg badge-neutral gap-1 font-semibold"
                  >
                    {alias}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
              <div className="join mt-3 w-full">
                <input
                  value={aliasDraft}
                  onChange={(event) => setAliasDraft(event.target.value)}
                  placeholder="Add an alias"
                  className="input input-bordered join-item min-w-0 flex-1 bg-base-200/30"
                />
                <button type="button" onClick={addAlias} className="btn btn-neutral join-item">
                  Add
                </button>
              </div>
            </div>
            <button type="submit" className={`${btnPrimary} mt-2`}>
              Save profile
            </button>
          </div>
        </form>

        <section className={cardClass}>
          <div className="card-body gap-4">
            <h2 className={cardHeading}>Blocked numbers</h2>
            <ul className="space-y-3">
              {blocked.length === 0 ? (
                <li className={metaMuted}>Nothing is blocked.</li>
              ) : (
                blocked.map((item) => (
                  <li
                    key={item.number}
                    className="flex items-start justify-between gap-3 rounded-box bg-base-200/60 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">{formatPhone(item.number)}</p>
                      <p className={metaMuted}>{item.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void removeBlocked(item.number).then((result) => setNote(result.message));
                      }}
                      className="btn btn-ghost btn-sm text-error"
                    >
                      Remove
                    </button>
                  </li>
                ))
              )}
            </ul>
            <form onSubmit={onBlock} className="space-y-4 border-t border-base-300/50 pt-4">
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">Add a number</legend>
                <input
                  id="block-number"
                  value={blockNumber}
                  onChange={(event) => setBlockNumber(event.target.value)}
                  placeholder="+18005550123"
                  className={inputClass}
                />
              </fieldset>
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">Reason</legend>
                <input
                  id="block-reason"
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                  placeholder="Why should Sift refuse this caller?"
                  className={inputClass}
                />
              </fieldset>
              <button type="submit" className={btnDanger}>
                Block number
              </button>
            </form>
          </div>
        </section>
      </div>
      {note ? <p className={`mt-4 ${metaMuted}`}>{note}</p> : null}
    </div>
  );
}

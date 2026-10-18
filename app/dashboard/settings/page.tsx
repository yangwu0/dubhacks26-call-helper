"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPhone } from "@/components/format";
import { useSiftDirectory } from "@/components/sift-provider";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
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
  const router = useRouter();
  const { owner, blocked, lineNote, lineStatus, saveOwner, addBlocked, removeBlocked } =
    useSiftDirectory();
  const [name, setName] = useState(owner.name);
  const [aliases, setAliases] = useState(owner.aliases);
  const [phone, setPhone] = useState(owner.phone);
  const [aliasDraft, setAliasDraft] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [note, setNote] = useState("");
  const dirty = useRef(false);
  const loadedOwner = useRef(owner.id);

  useEffect(() => {
    if (loadedOwner.current === owner.id && dirty.current) return;
    loadedOwner.current = owner.id;
    dirty.current = false;
    setName(owner.name);
    setAliases(owner.aliases);
    setPhone(owner.phone);
    setAliasDraft("");
    setBlockNumber("");
    setBlockReason("");
    setNote("");
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
        Sift texts the phone you already use. The number people call shows up on its own.
      </p>

      <div className={`${cardClass} mt-6`}>
        <div className="card-body gap-3">
          {owner.siftNumber ? (
            <>
              <h2 className={cardHeading}>Your Sift number</h2>
              <p className="font-display text-2xl font-bold">{formatPhone(owner.siftNumber)}</p>
              <p className={metaMuted}>
                {lineNote ||
                  "Text this number from your phone once. Sift can reply after that."}
              </p>
            </>
          ) : owner.phone ? (
            <>
              <h2 className={cardHeading}>Sift texts you</h2>
              <p className="font-display text-2xl font-bold">{formatPhone(owner.phone)}</p>
              <p className={metaMuted}>
                {lineStatus === "failed"
                  ? lineNote
                  : "Sift connects this phone to the shared Photon line. The number to text shows up here."}
              </p>
            </>
          ) : (
            <form onSubmit={onSave} className="flex flex-col gap-4">
              <h2 className={cardHeading}>Text me here</h2>
              <p className={metaMuted}>
                Use the phone you already have. Sift connects it to the shared Photon line. You do not buy a number.
              </p>
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">Your phone</legend>
                <input
                  id="setup-phone"
                  value={phone}
                  onChange={(event) => {
                    markDirty();
                    setPhone(event.target.value);
                  }}
                  placeholder="+12065550100"
                  className={inputClass}
                />
              </fieldset>
              <button type="submit" className={btnPrimary}>
                Save my phone
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <form onSubmit={onSave} className={cardClass}>
          <div className="card-body gap-4">
            <h2 className={cardHeading}>Owner</h2>
            <p className={metaMuted}>
              Your name, aliases, and phone are encrypted before they are stored.
            </p>
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
            {owner.phone ? (
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
            ) : null}
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

      <section className={`${cardClass} mt-5`}>
        <div className="card-body">
          <h2 className={cardHeading}>Sign out</h2>
          <p className={metaMuted}>Leave this account on this device.</p>
          <button
            type="button"
            onClick={() => {
              const supabase = getOptionalBrowserClient();
              void supabase?.auth.signOut().finally(() => {
                router.replace("/");
              });
            }}
            className="btn btn-outline mt-2 w-full font-semibold sm:w-auto"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

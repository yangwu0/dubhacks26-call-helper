"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mapBlocked, mapCall, mapOwner } from "@/components/map-call";
import { getOptionalBrowserClient } from "@/components/supabase-browser";
import {
  MOCK_BLOCKED,
  MOCK_CALLS,
  MOCK_OWNER,
  type BlockedNumber,
  type CallRecord,
  type OwnerProfile,
} from "@/lib/mockCallData";

type SaveResult = { ok: boolean; message: string };

type SiftDirectory = {
  calls: CallRecord[];
  owner: OwnerProfile;
  blocked: BlockedNumber[];
  usingSample: boolean;
  saveOwner: (next: OwnerProfile) => Promise<SaveResult>;
  addBlocked: (number: string, reason: string) => Promise<SaveResult>;
  removeBlocked: (number: string) => Promise<SaveResult>;
};

const SiftContext = createContext<SiftDirectory | null>(null);

export function SiftProvider({ children }: { children: ReactNode }) {
  const [calls, setCalls] = useState<CallRecord[]>(MOCK_CALLS);
  const [owner, setOwner] = useState<OwnerProfile>(MOCK_OWNER);
  const [blocked, setBlocked] = useState<BlockedNumber[]>(MOCK_BLOCKED);
  const [usingSample, setUsingSample] = useState(true);

  useEffect(() => {
    const supabase = getOptionalBrowserClient();
    if (!supabase) return;

    let request = 0;
    let cancelled = false;

    async function load() {
      const current = ++request;
      const [callsRes, eventsRes, ownerRes, blockedRes] = await Promise.all([
        supabase!
          .from("calls")
          .select("*")
          .order("started_at", { ascending: false }),
        supabase!
          .from("call_events")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase!.from("owners").select("*").limit(1).maybeSingle(),
        supabase!
          .from("blocked_numbers")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled || current !== request) return;
      if (!callsRes.error && callsRes.data) {
        const events = eventsRes.error ? [] : (eventsRes.data ?? []);
        setCalls(
          callsRes.data.map((row) =>
            mapCall(row as Record<string, unknown>, events as { call_id?: string; type?: string; payload?: unknown; created_at?: string; id?: number }[]),
          ),
        );
        setUsingSample(false);
      }
      if (!ownerRes.error && ownerRes.data) {
        setOwner(mapOwner(ownerRes.data as Record<string, unknown>));
      }
      if (!blockedRes.error && blockedRes.data) {
        setBlocked(
          blockedRes.data.map((row) => mapBlocked(row as Record<string, unknown>)),
        );
      }
    }

    void load();
    const channel = supabase
      .channel("sift-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_events" },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  const value = useMemo<SiftDirectory>(() => {
    return {
      calls,
      owner,
      blocked,
      usingSample,
      async saveOwner(next) {
        setOwner(next);
        const supabase = getOptionalBrowserClient();
        if (!supabase || !next.id) {
          return { ok: true, message: "Saved on this screen." };
        }
        const { error } = await supabase
          .from("owners")
          .update({
            name: next.name,
            aliases: next.aliases,
            phone: next.phone,
          })
          .eq("id", next.id);
        if (error) return { ok: false, message: "Couldn't save the profile." };
        return { ok: true, message: "Saved." };
      },
      async addBlocked(number, reason) {
        const entry: BlockedNumber = {
          number,
          reason,
          createdAt: new Date().toISOString(),
        };
        setBlocked((current) => [
          entry,
          ...current.filter((item) => item.number !== number),
        ]);
        const supabase = getOptionalBrowserClient();
        if (!supabase) return { ok: true, message: "Saved on this screen." };
        const { error } = await supabase
          .from("blocked_numbers")
          .upsert({ number, reason });
        if (error) return { ok: false, message: "Couldn't block that number." };
        return { ok: true, message: "Number blocked." };
      },
      async removeBlocked(number) {
        setBlocked((current) => current.filter((item) => item.number !== number));
        const supabase = getOptionalBrowserClient();
        if (!supabase) return { ok: true, message: "Saved on this screen." };
        const { error } = await supabase
          .from("blocked_numbers")
          .delete()
          .eq("number", number);
        if (error) return { ok: false, message: "Couldn't unblock that number." };
        return { ok: true, message: "Number unblocked." };
      },
    };
  }, [blocked, calls, owner, usingSample]);

  return <SiftContext.Provider value={value}>{children}</SiftContext.Provider>;
}

export function useSiftDirectory() {
  const value = useContext(SiftContext);
  if (!value) {
    throw new Error("useSiftDirectory must be used inside SiftProvider");
  }
  return value;
}

"use client";

import { useRouter } from "next/navigation";
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
import type { BlockedNumber, CallRecord, OwnerProfile } from "@/lib/mockCallData";

type SaveResult = { ok: boolean; message: string };

type SiftDirectory = {
  calls: CallRecord[];
  owner: OwnerProfile;
  blocked: BlockedNumber[];
  saveOwner: (next: OwnerProfile) => Promise<SaveResult>;
  addBlocked: (number: string, reason: string) => Promise<SaveResult>;
  removeBlocked: (number: string) => Promise<SaveResult>;
};

type EventRow = {
  call_id?: string;
  type?: string;
  payload?: unknown;
  created_at?: string;
  id?: number;
};

const EMPTY_OWNER: OwnerProfile = {
  id: "",
  name: "",
  aliases: [],
  phone: "",
};

const SiftContext = createContext<SiftDirectory | null>(null);

function schemaHint(message: string) {
  if (/schema cache|could not find the table|does not exist|user_id/i.test(message)) {
    return "Supabase is connected, but the Sift tables are not there yet. Run the database migration, then reload.";
  }
  return message;
}

export function SiftProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [owner, setOwner] = useState<OwnerProfile>(EMPTY_OWNER);
  const [blocked, setBlocked] = useState<BlockedNumber[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const browser = getOptionalBrowserClient();
    if (!browser) {
      setError("Supabase is not configured.");
      setPhase("error");
      return;
    }
    const supabase = browser;

    let request = 0;
    let cancelled = false;

    async function load(userId: string) {
      const current = ++request;
      const ownerRes = await supabase
        .from("owners")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || current !== request) return;
      if (ownerRes.error) {
        setError(schemaHint(ownerRes.error.message));
        setPhase("error");
        return;
      }
      if (!ownerRes.data) {
        setError("This account has no profile yet. Sign out and sign in again.");
        setPhase("error");
        return;
      }

      const nextOwner = mapOwner(ownerRes.data as Record<string, unknown>);
      const [callsRes, blockedRes] = await Promise.all([
        supabase
          .from("calls")
          .select("*")
          .eq("owner_id", nextOwner.id)
          .order("started_at", { ascending: false }),
        supabase
          .from("blocked_numbers")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled || current !== request) return;
      if (callsRes.error) {
        setError(schemaHint(callsRes.error.message));
        setPhase("error");
        return;
      }
      if (blockedRes.error) {
        setError(schemaHint(blockedRes.error.message));
        setPhase("error");
        return;
      }

      const callRows = callsRes.data ?? [];
      const callIds = callRows
        .map((row) => (row as { id?: string }).id)
        .filter((id): id is string => Boolean(id));
      const eventsRes =
        callIds.length === 0
          ? { data: [] as EventRow[], error: null }
          : await supabase
              .from("call_events")
              .select("*")
              .in("call_id", callIds)
              .order("created_at", { ascending: true });
      if (cancelled || current !== request) return;
      if (eventsRes.error) {
        setError(schemaHint(eventsRes.error.message));
        setPhase("error");
        return;
      }

      const events = (eventsRes.data ?? []) as EventRow[];
      setOwner(nextOwner);
      setCalls(
        callRows.map((row) => mapCall(row as Record<string, unknown>, events)),
      );
      setBlocked(
        (blockedRes.data ?? []).map((row) =>
          mapBlocked(row as Record<string, unknown>),
        ),
      );
      setError("");
      setPhase("ready");
    }

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const userId = data.session?.user.id;
      if (!userId) {
        router.replace("/");
        return;
      }
      await load(userId);
    }

    void start();
    const channel = supabase
      .channel("sift-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => {
          void supabase.auth.getSession().then(({ data }) => {
            const userId = data.session?.user.id;
            if (userId) void load(userId);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_events" },
        () => {
          void supabase.auth.getSession().then(({ data }) => {
            const userId = data.session?.user.id;
            if (userId) void load(userId);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const value = useMemo<SiftDirectory>(() => {
    return {
      calls,
      owner,
      blocked,
      async saveOwner(next) {
        setOwner(next);
        const supabase = getOptionalBrowserClient();
        if (!supabase || !next.id) {
          return { ok: false, message: "Sign in again before saving." };
        }
        const { error: saveError } = await supabase
          .from("owners")
          .update({
            name: next.name,
            aliases: next.aliases,
            phone: next.phone,
          })
          .eq("id", next.id);
        if (saveError) return { ok: false, message: "Couldn't save the profile." };
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
        if (!supabase) return { ok: false, message: "Sign in again before blocking." };
        const { error: blockError } = await supabase
          .from("blocked_numbers")
          .upsert({ number, reason });
        if (blockError) return { ok: false, message: "Couldn't block that number." };
        return { ok: true, message: "Number blocked." };
      },
      async removeBlocked(number) {
        setBlocked((current) => current.filter((item) => item.number !== number));
        const supabase = getOptionalBrowserClient();
        if (!supabase) return { ok: false, message: "Sign in again before unblocking." };
        const { error: removeError } = await supabase
          .from("blocked_numbers")
          .delete()
          .eq("number", number);
        if (removeError) return { ok: false, message: "Couldn't unblock that number." };
        return { ok: true, message: "Number unblocked." };
      },
    };
  }, [blocked, calls, owner]);

  return (
    <SiftContext.Provider value={value}>
      {phase === "error" ? (
        <main className="grid min-h-screen place-items-center px-6">
          <div className="max-w-md text-center">
            <p className="text-lg text-base-content/70">{error}</p>
            <button
              type="button"
              onClick={() => {
                const supabase = getOptionalBrowserClient();
                void supabase?.auth.signOut().finally(() => {
                  router.replace("/");
                });
              }}
              className="btn btn-ghost mt-6"
            >
              Back to sign in
            </button>
          </div>
        </main>
      ) : (
        children
      )}
    </SiftContext.Provider>
  );
}

export function useSiftDirectory() {
  const value = useContext(SiftContext);
  if (!value) {
    throw new Error("useSiftDirectory must be used inside SiftProvider");
  }
  return value;
}

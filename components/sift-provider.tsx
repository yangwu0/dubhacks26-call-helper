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
  lineNote: string;
  lineStatus: "" | "ready" | "pending" | "failed" | "unconfigured";
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
  siftNumber: "",
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
  const [lineNote, setLineNote] = useState("");
  const [lineStatus, setLineStatus] = useState<SiftDirectory["lineStatus"]>("");
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
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token ?? "";
      if (sessionRes.data.session?.user.id !== userId || !token) {
        setError("Sign in again.");
        setPhase("error");
        return;
      }
      const accountRes = await fetch("/api/account", {
        headers: { authorization: `Bearer ${token}` },
      });
      const accountBody = (await accountRes.json().catch(() => null)) as {
        id?: unknown;
        name?: unknown;
        aliases?: unknown;
        phone?: unknown;
        siftNumber?: unknown;
        error?: unknown;
      } | null;
      if (cancelled || current !== request) return;
      if (!accountRes.ok || !accountBody || typeof accountBody.id !== "string") {
        const message =
          accountBody && typeof accountBody.error === "string"
            ? accountBody.error
            : "Could not load this account.";
        setError(schemaHint(message));
        setPhase("error");
        return;
      }

      const nextOwner = mapOwner({
        id: accountBody.id,
        name: accountBody.name,
        aliases: accountBody.aliases,
        phone: accountBody.phone,
        sift_number: accountBody.siftNumber,
      });
      const [callsRes, blockedRes] = await Promise.all([
        supabase
          .from("calls")
          .select("*")
          .eq("owner_id", nextOwner.id)
          .order("started_at", { ascending: false }),
        supabase
          .from("blocked_numbers")
          .select("*")
          .eq("owner_id", nextOwner.id)
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

    let seenUser = "";

    function clearAccount() {
      setCalls([]);
      setBlocked([]);
      setOwner(EMPTY_OWNER);
      setLineNote("");
      setLineStatus("");
    }

    async function showUser(userId: string) {
      if (!userId || userId === seenUser) return;
      seenUser = userId;
      clearAccount();
      await load(userId);
    }

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const userId = data.session?.user.id ?? "";
      if (!userId) {
        seenUser = "";
        clearAccount();
        router.replace("/");
        return;
      }
      await showUser(userId);
    }

    void start();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? "";
      if (userId === seenUser) return;
      window.setTimeout(() => {
        if (cancelled) return;
        if (!userId) {
          seenUser = "";
          clearAccount();
          return;
        }
        void showUser(userId);
      }, 0);
    });
    let syncTimer = 0;
    const syncLiveTranscript = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;
      await fetch("/api/live/sync", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    };
    void syncLiveTranscript();
    syncTimer = window.setInterval(() => {
      void syncLiveTranscript();
    }, 4000);
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
      window.clearInterval(syncTimer);
      authListener.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    if (!owner.id) return;
    let cancelled = false;
    let timer = 0;

    async function claimLine() {
      const browser = getOptionalBrowserClient();
      const session = await browser?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token || cancelled) return;
      const response = await fetch("/api/line", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => null)) as {
        number?: unknown;
        message?: unknown;
        status?: unknown;
      } | null;
      if (cancelled || !body) return;
      const number = typeof body.number === "string" ? body.number : "";
      const message = typeof body.message === "string" ? body.message : "";
      const status = body.status;
      setLineNote(message);
      setLineStatus(
        status === "ready" ||
          status === "pending" ||
          status === "failed" ||
          status === "unconfigured"
          ? status
          : "",
      );
      if (number) {
        setOwner((current) =>
          current.id === owner.id ? { ...current, siftNumber: number } : current,
        );
        return;
      }
      if (body.status === "pending") {
        timer = window.setTimeout(() => {
          void claimLine();
        }, 5000);
      }
    }

    void claimLine();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [owner.id, owner.siftNumber]);

  const value = useMemo<SiftDirectory>(() => {
    return {
      calls,
      owner,
      blocked,
      lineNote,
      lineStatus,
      async saveOwner(next) {
        setOwner(next);
        const supabase = getOptionalBrowserClient();
        if (!supabase || !next.id) {
          return { ok: false, message: "Sign in again before saving." };
        }
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token ?? "";
        if (!token) return { ok: false, message: "Sign in again before saving." };
        const response = await fetch("/api/account", {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: next.name,
            aliases: next.aliases,
            phone: next.phone,
          }),
        });
        const body = (await response.json().catch(() => null)) as {
          message?: unknown;
          error?: unknown;
          phone?: unknown;
        } | null;
        if (!response.ok) {
          const error = body && typeof body.error === "string" ? body.error : "";
          return { ok: false, message: error || "Couldn't save the profile." };
        }
        if (body && typeof body.phone === "string") {
          setOwner((current) =>
            current.id === next.id ? { ...current, phone: body.phone as string } : current,
          );
        }
        const message = body && typeof body.message === "string" ? body.message : "Saved.";
        return { ok: true, message };
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
        if (!supabase || !owner.id) return { ok: false, message: "Sign in again before blocking." };
        const { error: blockError } = await supabase.from("blocked_numbers").upsert(
          { number, reason, owner_id: owner.id },
          { onConflict: "owner_id,number" },
        );
        if (blockError) return { ok: false, message: "Couldn't block that number." };
        return { ok: true, message: "Number blocked." };
      },
      async removeBlocked(number) {
        setBlocked((current) => current.filter((item) => item.number !== number));
        const supabase = getOptionalBrowserClient();
        if (!supabase || !owner.id) {
          return { ok: false, message: "Sign in again before unblocking." };
        }
        const { error: removeError } = await supabase
          .from("blocked_numbers")
          .delete()
          .eq("owner_id", owner.id)
          .eq("number", number);
        if (removeError) return { ok: false, message: "Couldn't unblock that number." };
        return { ok: true, message: "Number unblocked." };
      },
    };
  }, [blocked, calls, lineNote, lineStatus, owner]);

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

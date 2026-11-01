import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CallSession, type CallState } from "@/lib/calls/call-session";
import type { CallKind, IncomingCall } from "@/lib/calls/calls-client";
import {
  callsClient,
  callsSupported,
  createBrowserPeer,
  createSupabaseCallTransport,
  getCallMedia,
} from "@/lib/calls/supabase-calls";
import { BackendNotReadyError } from "@/lib/friends/rpc";
import { ActiveCallOverlay } from "./ActiveCallOverlay";
import { IncomingCallDialog } from "./IncomingCallDialog";

export type CallPeer = { id: string; name: string; avatarUrl: string | null };

export type ActiveCall = {
  callId: string;
  role: "caller" | "callee";
  kind: CallKind;
  peer: CallPeer;
  session: CallSession;
};

type CallsContextValue = {
  supported: boolean;
  /** True while a call is ringing or running. */
  inCall: boolean;
  startCall: (peer: CallPeer, kind: CallKind, conversationId?: string | null) => Promise<void>;
};

const CallsContext = createContext<CallsContextValue>({
  supported: false,
  inCall: false,
  startCall: async () => undefined,
});

export function useCalls(): CallsContextValue {
  return useContext(CallsContext);
}

const INCOMING_POLL_MS = 6000;

export function CallProvider({
  userId,
  isGuest,
  children,
}: {
  userId: string;
  isGuest: boolean;
  children: ReactNode;
}) {
  const supported = callsSupported() && !isGuest;
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [state, setState] = useState<CallState | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall[]>([]);
  const activeRef = useRef<ActiveCall | null>(null);
  activeRef.current = active;
  const dismissed = useRef<Set<string>>(new Set());

  const begin = useCallback(
    async (call: Omit<ActiveCall, "session">) => {
      const session = new CallSession({
        callId: call.callId,
        role: call.role,
        kind: call.kind,
        myUserId: userId,
        transport: createSupabaseCallTransport(),
        createPeer: () => createBrowserPeer() as never,
        getMedia: (kind) => getCallMedia(kind) as never,
      });
      const next: ActiveCall = { ...call, session };
      activeRef.current = next;
      setActive(next);
      setState(session.getState());
      session.onChange((s) => {
        setState(s);
        if (s.phase === "ended" || s.phase === "failed") {
          if (s.message) toast(s.message);
          window.setTimeout(() => {
            setActive((current) => (current?.callId === call.callId ? null : current));
          }, 1200);
        }
      });
      await session.start();
    },
    [userId],
  );

  const startCall = useCallback(
    async (peer: CallPeer, kind: CallKind, conversationId?: string | null) => {
      if (!supported) {
        toast("Anrufe werden von diesem Gerät oder Browser nicht unterstützt.");
        return;
      }
      if (activeRef.current) {
        toast("Du bist bereits in einem Anruf.");
        return;
      }
      try {
        const result = await callsClient.start(peer.id, kind, conversationId);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        await begin({ callId: result.callId, role: "caller", kind, peer });
      } catch (error) {
        toast(
          error instanceof BackendNotReadyError
            ? "Anrufe sind auf dem Server noch nicht eingerichtet."
            : "Der Anruf konnte nicht gestartet werden.",
        );
      }
    },
    [begin, supported],
  );

  const refreshIncoming = useCallback(async () => {
    if (!supported) return;
    try {
      const list = await callsClient.listIncoming();
      setIncoming(list.filter((call) => !dismissed.current.has(call.callId)));
    } catch {
      // Calls are optional; keep quiet when the backend is unavailable.
    }
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    void refreshIncoming();
    const channel = supabase
      .channel(`incoming-calls-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` },
        () => void refreshIncoming(),
      )
      .subscribe();
    const interval = setInterval(() => void refreshIncoming(), INCOMING_POLL_MS);
    const onFocus = () => void refreshIncoming();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [refreshIncoming, supported, userId]);

  const answer = useCallback(
    async (call: IncomingCall, accept: boolean) => {
      dismissed.current.add(call.callId);
      setIncoming((list) => list.filter((entry) => entry.callId !== call.callId));
      try {
        const result = await callsClient.respond(call.callId, accept);
        if (!accept) return;
        if (result !== "accepted") {
          toast("Der Anruf wurde bereits beendet.");
          return;
        }
        await begin({
          callId: call.callId,
          role: "callee",
          kind: call.kind,
          peer: { id: call.callerId, name: call.callerName, avatarUrl: call.callerAvatarUrl },
        });
      } catch {
        toast("Die Antwort auf den Anruf konnte nicht gesendet werden.");
      }
    },
    [begin],
  );

  const value = useMemo<CallsContextValue>(
    () => ({ supported, inCall: active !== null, startCall }),
    [active, startCall, supported],
  );

  const ringing = active ? null : (incoming[0] ?? null);

  return (
    <CallsContext.Provider value={value}>
      {children}
      <IncomingCallDialog
        call={ringing}
        onAnswer={(accept) => ringing && void answer(ringing, accept)}
      />
      {active && state && <ActiveCallOverlay call={active} state={state} />}
    </CallsContext.Provider>
  );
}

/** Browser/Supabase bindings for calls. Not imported by unit tests. */
import { supabase } from "@/integrations/supabase/client";
import type { RpcGateway } from "../friends/rpc";
import {
  createCallsClient,
  parseCallSignals,
  type CallSignal,
  type CallSignalType,
} from "./calls-client";
import type { CallTransport } from "./call-session";
import { buildIceServers } from "./ice";

export const callsClient = createCallsClient(supabase as unknown as RpcGateway);

type LooseQuery = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): {
        gt(
          column: string,
          value: unknown,
        ): {
          order(
            column: string,
            opts: { ascending: boolean },
          ): PromiseLike<{ data: unknown; error: unknown }>;
        };
        maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
};
const loose = supabase as unknown as LooseQuery;

export function createSupabaseCallTransport(): CallTransport {
  return {
    sendSignal: (callId: string, type: CallSignalType, payload: unknown) =>
      callsClient.sendSignal(callId, type, payload),
    async fetchSignals(callId: string, afterId: number): Promise<CallSignal[]> {
      const { data, error } = await loose
        .from("call_signals")
        .select("id, call_id, sender_id, type, payload")
        .eq("call_id", callId)
        .gt("id", afterId)
        .order("id", { ascending: true });
      if (error) return [];
      return parseCallSignals(data);
    },
    async fetchStatus(callId: string): Promise<string | null> {
      const { data, error } = await loose
        .from("calls")
        .select("status")
        .eq("id", callId)
        .maybeSingle();
      if (error || !data) return null;
      const status = (data as { status?: unknown }).status;
      return typeof status === "string" ? status : null;
    },
    end: (callId: string, failed: boolean) => callsClient.end(callId, failed),
    subscribe(callId: string, onChange: () => void) {
      const channel = supabase
        .channel(`call-${callId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "call_signals",
            filter: `call_id=eq.${callId}`,
          },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
          onChange,
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}

export function createBrowserPeer(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: buildIceServers(import.meta.env as never) });
}

export function getCallMedia(kind: "audio" | "video"): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video:
      kind === "video"
        ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
  });
}

export function callsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

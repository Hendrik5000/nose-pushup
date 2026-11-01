import {
  asRecord,
  asString,
  FriendFeatureError,
  isUuid,
  unwrapRpc,
  type RpcGateway,
} from "../friends/rpc";

export type CallKind = "audio" | "video";
export type CallStatus =
  "ringing" | "accepted" | "declined" | "cancelled" | "missed" | "ended" | "failed";

export type StartCallStatus =
  "ringing" | "callee_busy" | "already_in_call" | "not_friends" | "invalid_kind" | "unavailable";

export type StartCallResult =
  { ok: true; callId: string } | { ok: false; status: StartCallStatus; message: string };

export const START_CALL_MESSAGES: Record<Exclude<StartCallStatus, "ringing">, string> = {
  callee_busy: "Dein Freund ist gerade in einem anderen Anruf.",
  already_in_call: "Du bist bereits in einem Anruf.",
  not_friends: "Anrufe sind nur mit Freunden möglich.",
  invalid_kind: "Diese Anrufart wird nicht unterstützt.",
  unavailable: "Der Anruf konnte nicht gestartet werden.",
};

export type IncomingCall = {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  kind: CallKind;
  conversationId: string | null;
  createdAt: string;
};

export type CallSignalType = "offer" | "answer" | "candidate";
export type CallSignal = {
  id: number;
  callId: string;
  senderId: string;
  type: CallSignalType;
  payload: unknown;
};

const SIGNAL_TYPES: readonly string[] = ["offer", "answer", "candidate"];

export function parseIncomingCalls(rows: unknown): IncomingCall[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): IncomingCall[] => {
    const r = asRecord(row);
    if (!isUuid(r.call_id) || !isUuid(r.caller_id)) return [];
    return [
      {
        callId: r.call_id,
        callerId: r.caller_id,
        callerName: asString(r.caller_name) ?? "Freund",
        callerAvatarUrl: asString(r.caller_avatar_url),
        kind: r.kind === "video" ? "video" : "audio",
        conversationId: isUuid(r.conversation_id) ? r.conversation_id : null,
        createdAt: asString(r.created_at) ?? "",
      },
    ];
  });
}

export function parseCallSignals(rows: unknown): CallSignal[] {
  if (!Array.isArray(rows)) return [];
  const signals = rows.flatMap((row): CallSignal[] => {
    const r = asRecord(row);
    const id =
      typeof r.id === "number" ? r.id : typeof r.id === "string" ? Number(r.id) : Number.NaN;
    if (!Number.isFinite(id) || !isUuid(r.call_id) || !isUuid(r.sender_id)) return [];
    if (!SIGNAL_TYPES.includes(String(r.type))) return [];
    return [
      {
        id,
        callId: r.call_id,
        senderId: r.sender_id,
        type: r.type as CallSignalType,
        payload: r.payload,
      },
    ];
  });
  return signals.sort((a, b) => a.id - b.id);
}

export function isFinalStatus(status: string | null | undefined): boolean {
  return (
    status === "declined" ||
    status === "cancelled" ||
    status === "missed" ||
    status === "ended" ||
    status === "failed"
  );
}

export function describeEndReason(
  status: string | null | undefined,
  role: "caller" | "callee",
): string {
  switch (status) {
    case "declined":
      return role === "caller" ? "Der Anruf wurde abgelehnt." : "Anruf abgelehnt.";
    case "missed":
      return role === "caller" ? "Keine Antwort." : "Verpasster Anruf.";
    case "cancelled":
      return "Der Anruf wurde abgebrochen.";
    case "failed":
      return "Die Verbindung ist fehlgeschlagen.";
    default:
      return "Anruf beendet.";
  }
}

export function createCallsClient(gateway: RpcGateway) {
  return {
    async start(
      calleeId: string,
      kind: CallKind,
      conversationId?: string | null,
    ): Promise<StartCallResult> {
      if (!isUuid(calleeId)) throw new FriendFeatureError("Ungültiger Kontakt.");
      const data = asRecord(
        unwrapRpc(
          await gateway.rpc("start_call", {
            p_callee: calleeId,
            p_kind: kind,
            p_conversation: conversationId && isUuid(conversationId) ? conversationId : null,
          }),
          "Der Anruf konnte nicht gestartet werden.",
        ),
      );
      if (data.status === "ringing" && isUuid(data.call_id))
        return { ok: true, callId: data.call_id };
      const status = String(data.status) as StartCallStatus;
      const known =
        status in START_CALL_MESSAGES
          ? (status as Exclude<StartCallStatus, "ringing">)
          : "unavailable";
      return { ok: false, status: known, message: START_CALL_MESSAGES[known] };
    },

    async respond(
      callId: string,
      accept: boolean,
    ): Promise<"accepted" | "declined" | "missed" | "stale"> {
      if (!isUuid(callId)) throw new FriendFeatureError("Ungültiger Anruf.");
      const data = unwrapRpc(
        await gateway.rpc("respond_to_call", { p_call_id: callId, p_accept: accept }),
        "Die Antwort auf den Anruf konnte nicht gesendet werden.",
      );
      return data === "accepted" || data === "declined" || data === "missed" ? data : "stale";
    },

    async end(callId: string, failed = false): Promise<string> {
      if (!isUuid(callId)) return "stale";
      const data = unwrapRpc(
        await gateway.rpc("end_call", { p_call_id: callId, p_failed: failed }),
        "Der Anruf konnte nicht beendet werden.",
      );
      return typeof data === "string" ? data : "stale";
    },

    async sendSignal(callId: string, type: CallSignalType, payload: unknown): Promise<boolean> {
      if (!isUuid(callId) || !SIGNAL_TYPES.includes(type)) return false;
      const data = unwrapRpc(
        await gateway.rpc("send_call_signal", {
          p_call_id: callId,
          p_type: type,
          p_payload: payload,
        }),
        "Das Anrufsignal konnte nicht gesendet werden.",
      );
      return data === true;
    },

    async listIncoming(): Promise<IncomingCall[]> {
      return parseIncomingCalls(
        unwrapRpc(
          await gateway.rpc("get_my_incoming_calls"),
          "Eingehende Anrufe konnten nicht geladen werden.",
        ),
      );
    },
  };
}

export type CallsClient = ReturnType<typeof createCallsClient>;

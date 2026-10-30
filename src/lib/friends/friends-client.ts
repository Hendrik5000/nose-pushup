import { isValidFriendCode, normalizeFriendCode } from "./friend-code";
import { asRecord, asString, FriendFeatureError, isUuid, unwrapRpc, type RpcGateway } from "./rpc";

export type SendFriendRequestStatus =
  | "sent"
  | "already_friends"
  | "already_sent"
  | "incoming_pending"
  | "own_code"
  | "invalid_code"
  | "too_many_attempts"
  | "too_many_pending"
  | "unavailable";

export type SendFriendRequestResult = {
  status: SendFriendRequestStatus;
  friendshipId: string | null;
  toName: string | null;
  /** German text that can be shown directly. */
  message: string;
  ok: boolean;
};

const KNOWN_STATUSES: readonly SendFriendRequestStatus[] = [
  "sent",
  "already_friends",
  "already_sent",
  "incoming_pending",
  "own_code",
  "invalid_code",
  "too_many_attempts",
  "too_many_pending",
  "unavailable",
];

export function describeSendResult(
  status: SendFriendRequestStatus,
  toName?: string | null,
): string {
  switch (status) {
    case "sent":
      return `Einladung an ${toName ?? "deinen Freund"} gesendet. Sie muss sie im Postfach annehmen.`;
    case "already_friends":
      return "Ihr seid bereits befreundet.";
    case "already_sent":
      return "Du hast diese Einladung schon gesendet. Sie wartet auf Annahme.";
    case "incoming_pending":
      return "Diese Person hat dir bereits eine Einladung geschickt. Nimm sie im Postfach an.";
    case "own_code":
      return "Das ist dein eigener Code. Teile ihn mit deinem Freund.";
    case "invalid_code":
      return "Dieser Code ist ungültig. Prüfe die Eingabe.";
    case "too_many_attempts":
      return "Zu viele falsche Versuche. Versuche es in einer Stunde erneut.";
    case "too_many_pending":
      return "Du hast zu viele offene Einladungen. Warte, bis einige beantwortet sind.";
    case "unavailable":
    default:
      return "Mit diesem Code ist gerade keine Einladung möglich.";
  }
}

export type SentFriendRequest = {
  friendshipId: string;
  toUserId: string;
  toName: string;
  toAvatarUrl: string | null;
  createdAt: string;
};

export type RespondResult = "accepted" | "declined" | "stale";

export function createFriendsClient(gateway: RpcGateway) {
  return {
    async getMyCode(): Promise<string> {
      const data = unwrapRpc(
        await gateway.rpc("get_my_friend_code"),
        "Dein Code konnte nicht geladen werden.",
      );
      const code = normalizeFriendCode(typeof data === "string" ? data : "");
      if (!isValidFriendCode(code))
        throw new FriendFeatureError("Dein Code konnte nicht geladen werden.");
      return code;
    },

    async regenerateMyCode(): Promise<string> {
      const data = unwrapRpc(
        await gateway.rpc("regenerate_my_friend_code"),
        "Der Code konnte nicht erneuert werden.",
      );
      const code = normalizeFriendCode(typeof data === "string" ? data : "");
      if (!isValidFriendCode(code))
        throw new FriendFeatureError("Der Code konnte nicht erneuert werden.");
      return code;
    },

    async sendRequestByCode(input: string): Promise<SendFriendRequestResult> {
      const code = normalizeFriendCode(input);
      if (!isValidFriendCode(code)) {
        return {
          status: "invalid_code",
          friendshipId: null,
          toName: null,
          message: describeSendResult("invalid_code"),
          ok: false,
        };
      }
      const data = asRecord(
        unwrapRpc(
          await gateway.rpc("send_friend_request_by_code", { p_code: code }),
          "Die Einladung konnte nicht gesendet werden.",
        ),
      );
      const raw = asString(data.status);
      const status = (KNOWN_STATUSES as readonly string[]).includes(raw ?? "")
        ? (raw as SendFriendRequestStatus)
        : "unavailable";
      const toName = asString(data.to_name);
      return {
        status,
        friendshipId: isUuid(data.friendship_id) ? data.friendship_id : null,
        toName,
        message: describeSendResult(status, toName),
        ok: status === "sent",
      };
    },

    async respond(friendshipId: string, accept: boolean): Promise<RespondResult> {
      if (!isUuid(friendshipId)) throw new FriendFeatureError("Ungültige Einladung.");
      const data = unwrapRpc(
        await gateway.rpc("respond_to_friend_request", {
          p_friendship_id: friendshipId,
          p_accept: accept,
        }),
        "Die Antwort konnte nicht gesendet werden.",
      );
      return data === "accepted" || data === "declined" ? data : "stale";
    },

    async withdraw(friendshipId: string): Promise<boolean> {
      if (!isUuid(friendshipId)) throw new FriendFeatureError("Ungültige Einladung.");
      const data = unwrapRpc(
        await gateway.rpc("withdraw_friend_request", { p_friendship_id: friendshipId }),
        "Die Einladung konnte nicht zurückgezogen werden.",
      );
      return data === true;
    },

    async listSent(): Promise<SentFriendRequest[]> {
      const data = unwrapRpc(
        await gateway.rpc("get_my_sent_friend_requests"),
        "Gesendete Einladungen konnten nicht geladen werden.",
      );
      if (!Array.isArray(data)) return [];
      return data.flatMap((row): SentFriendRequest[] => {
        const r = asRecord(row);
        if (!isUuid(r.friendship_id) || !isUuid(r.to_user_id)) return [];
        return [
          {
            friendshipId: r.friendship_id,
            toUserId: r.to_user_id,
            toName: asString(r.to_name) ?? "Freund",
            toAvatarUrl: asString(r.to_avatar_url),
            createdAt: asString(r.created_at) ?? "",
          },
        ];
      });
    },
  };
}

export type FriendsClient = ReturnType<typeof createFriendsClient>;

export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};
export type FriendProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  level?: number | null;
  xp?: number | null;
  current_streak?: number | null;
  battle_wins?: number | null;
};
export type FriendEntry = {
  friendshipId: string;
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  streak: number;
  battleWins: number;
};

/** Accepted friendships only, one entry per friend, sorted by name. */
export function buildFriendEntries(
  userId: string,
  friendships: readonly FriendshipRow[],
  profiles: readonly FriendProfileRow[],
): FriendEntry[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const entries: FriendEntry[] = [];
  for (const f of friendships) {
    if (f.status !== "accepted") continue;
    if (f.requester_id !== userId && f.addressee_id !== userId) continue;
    const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
    if (otherId === userId || seen.has(otherId)) continue;
    seen.add(otherId);
    const p = byId.get(otherId);
    entries.push({
      friendshipId: f.id,
      id: otherId,
      displayName: p?.display_name?.trim() || "Freund",
      avatarUrl: p?.avatar_url ?? null,
      level: p?.level ?? 1,
      xp: p?.xp ?? 0,
      streak: p?.current_streak ?? 0,
      battleWins: p?.battle_wins ?? 0,
    });
  }
  return entries.sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
}

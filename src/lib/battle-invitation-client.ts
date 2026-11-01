import { BackendNotReadyError, isBackendMissing } from "@/lib/friends/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { BATTLE_MODES, type BattleMode } from "@/lib/battle.functions";

export type BattleInvitationStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export type BattleInvitationFriend = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type IncomingBattleInvitation = {
  id: string;
  senderId: string;
  senderDisplayName: string | null;
  senderAvatarUrl: string | null;
  mode: BattleMode;
  durationS: number;
  targetReps: number;
  createdAt: string;
  expiresAt: string;
};

export type SentBattleInvitation = {
  id: string;
  recipientId: string;
  status: BattleInvitationStatus;
  battleId: string | null;
  mode: BattleMode;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
};

export type WaitingFriendBattle = {
  id: string;
};

export type BattleInvitationDashboard = {
  userId: string;
  friends: BattleInvitationFriend[];
  incoming: IncomingBattleInvitation[];
  sent: SentBattleInvitation[];
};

export type BattleInvitationRpcName =
  | "get_friend_public_profiles"
  | "create_friend_battle_invitation"
  | "get_my_pending_battle_invitations"
  | "get_my_sent_friend_battle_invitations"
  | "respond_to_friend_battle_invitation"
  | "cancel_my_friend_battle_invitation";

export type BattleInvitationRpcArguments = {
  get_friend_public_profiles: { p_user_ids: string[] };
  create_friend_battle_invitation: {
    p_recipient_id: string;
    p_mode: BattleMode;
    p_duration_s: number;
    p_target_reps: number;
  };
  get_my_pending_battle_invitations: Record<string, never>;
  get_my_sent_friend_battle_invitations: Record<string, never>;
  respond_to_friend_battle_invitation: { p_invitation_id: string; p_accept: boolean };
  cancel_my_friend_battle_invitation: { p_invitation_id: string };
};

export type BattleInvitationGatewayResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export type BattleInvitationFriendshipRow = {
  requester_id: string;
  addressee_id: string;
  status: string;
};

export type BattleInvitationProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type BattleInvitationBattleRow = {
  id: string;
  code: string;
  status: string;
  host_id: string;
  guest_id: string | null;
  is_bot: boolean;
};

export interface BattleInvitationGateway {
  getCurrentUser(): Promise<BattleInvitationGatewayResult<{ id: string; isAnonymous: boolean }>>;
  listFriendships(
    userId: string,
  ): Promise<BattleInvitationGatewayResult<BattleInvitationFriendshipRow[]>>;
  getFriendProfiles(
    userIds: string[],
  ): Promise<BattleInvitationGatewayResult<BattleInvitationProfileRow[]>>;
  rpc<K extends BattleInvitationRpcName>(
    name: K,
    args: BattleInvitationRpcArguments[K],
  ): Promise<BattleInvitationGatewayResult<unknown>>;
  getBattleById(
    battleId: string,
  ): Promise<BattleInvitationGatewayResult<BattleInvitationBattleRow>>;
}

export type BattleInvitationResponse = {
  result: "accepted" | "declined" | "expired" | "cancelled" | "stale";
  battleId: string | null;
};

export type BattleInvitationClient = {
  enabled: boolean;
  loadDashboard(): Promise<BattleInvitationDashboard>;
  sendInvitation(input: {
    recipientId: string;
    mode: BattleMode;
    durationS: number;
    targetReps: number;
  }): Promise<string>;
  respondToInvitation(
    invitationId: string,
    senderId: string,
    accept: boolean,
  ): Promise<BattleInvitationResponse>;
  cancelInvitation(invitationId: string): Promise<boolean>;
  lookupWaitingBattle(
    battleId: string,
    expectedFriendId: string,
  ): Promise<WaitingFriendBattle | null>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVITATION_STATUSES: readonly BattleInvitationStatus[] = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
];
const MODES: readonly string[] = BATTLE_MODES;
const GATE_CLOSED =
  "Freundebattles bleiben gesperrt, bis die Migration am Alo-Ziel geprüft und freigegeben ist.";

function fail(message: string): never {
  throw new Error(message);
}

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(message);
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown, message: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return fail(message);
  return value;
}

function requireMode(value: unknown, message: string): BattleMode {
  if (typeof value !== "string" || !MODES.includes(value)) return fail(message);
  return value as BattleMode;
}

function requireStringOrNull(value: unknown, message: string): string | null {
  if (value === null || typeof value === "string") return value;
  return fail(message);
}

function requireRpcRows(value: unknown, message: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) return fail(message);
  return value.map((row) => requireObject(row, message));
}

function checkResult<T>(result: BattleInvitationGatewayResult<T>, message: string): T {
  if (result.error) {
    if (isBackendMissing(result.error)) throw new BackendNotReadyError();
    throw new Error(message);
  }
  if (result.data === null) throw new Error(message);
  return result.data;
}

/**
 * Business adapter for the local candidate contract. The default is deliberately
 * closed and checks the gate before consulting even the injected gateway.
 */
export function createBattleInvitationClient(
  gateway: BattleInvitationGateway,
  options: { migrationVerified?: boolean } = {},
): BattleInvitationClient {
  const enabled = options.migrationVerified === true;

  const assertEnabled = () => {
    if (!enabled) throw new Error(GATE_CLOSED);
  };

  const requireRegisteredUser = async (expectedUserId?: string) => {
    assertEnabled();
    const user = checkResult(await gateway.getCurrentUser(), "Konto konnte nicht geprüft werden.");
    if (!user.id || !UUID_PATTERN.test(user.id) || user.isAnonymous) {
      throw new Error("Freundebattles sind nur mit einem registrierten Konto verfügbar.");
    }
    if (expectedUserId && user.id !== expectedUserId) {
      throw new Error("Das aktive Konto hat sich geändert. Bitte lade die Battle-Lobby neu.");
    }
    return user;
  };

  const assertSameUser = async (expectedUserId: string) => {
    await requireRegisteredUser(expectedUserId);
  };

  const loadFriends = async (userId: string): Promise<BattleInvitationFriend[]> => {
    const friendshipRows = checkResult(
      await gateway.listFriendships(userId),
      "Freundeliste konnte nicht geladen werden.",
    );
    const friendIds: string[] = [];
    for (const row of friendshipRows) {
      if (row.status !== "accepted") continue;
      if (
        !UUID_PATTERN.test(row.requester_id) ||
        !UUID_PATTERN.test(row.addressee_id) ||
        row.requester_id === row.addressee_id
      ) {
        throw new Error("Freundeliste enthält einen ungültigen Eintrag.");
      }
      if (row.requester_id !== userId && row.addressee_id !== userId) {
        throw new Error("Freundeliste enthält einen Eintrag für ein anderes Konto.");
      }
      const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
      if (friendIds.includes(otherId)) {
        throw new Error("Mehrdeutige Freundschaft erkannt. Die Auswahl wurde gesperrt.");
      }
      friendIds.push(otherId);
    }
    if (friendIds.length === 0) return [];

    const profiles = checkResult(
      await gateway.getFriendProfiles(friendIds),
      "Freunde konnten nicht sicher geladen werden.",
    );
    const byId = new Map<string, BattleInvitationProfileRow>();
    for (const profile of profiles) {
      if (
        !UUID_PATTERN.test(profile.id) ||
        byId.has(profile.id) ||
        !friendIds.includes(profile.id)
      ) {
        throw new Error("Freunde konnten nicht eindeutig zugeordnet werden.");
      }
      byId.set(profile.id, profile);
    }
    if (byId.size !== friendIds.length) {
      throw new Error("Freundesdaten sind unvollständig. Die Auswahl wurde gesperrt.");
    }
    return friendIds.map((id) => {
      const profile = byId.get(id)!;
      return { id, displayName: profile.display_name, avatarUrl: profile.avatar_url };
    });
  };

  const loadIncoming = async (userId: string): Promise<IncomingBattleInvitation[]> => {
    const raw = await gateway.rpc("get_my_pending_battle_invitations", {});
    const rows = requireRpcRows(
      checkResult(raw, "Battle-Einladungen konnten nicht geladen werden."),
      "Unerwartete Antwort im Battle-Postfach.",
    );
    const now = Date.now();
    const seen = new Set<string>();
    const result: IncomingBattleInvitation[] = [];
    for (const row of rows) {
      const id = requireUuid(row.invitation_id, "Ungültige Battle-Einladung.");
      const senderId = requireUuid(row.sender_id, "Ungültige Absenderidentität.");
      if (senderId === userId || seen.has(id)) {
        throw new Error("Mehrdeutige Battle-Einladung. Das Postfach wurde gesperrt.");
      }
      seen.add(id);
      const durationS = row.duration_s;
      const targetReps = row.target_reps;
      const createdAt = row.created_at;
      const expiresAt = row.expires_at;
      const createdMs = typeof createdAt === "string" ? Date.parse(createdAt) : Number.NaN;
      const expiresMs = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
      if (
        typeof durationS !== "number" ||
        !Number.isInteger(durationS) ||
        durationS < 15 ||
        durationS > 600 ||
        typeof targetReps !== "number" ||
        !Number.isInteger(targetReps) ||
        targetReps < 0 ||
        targetReps > 500 ||
        !Number.isFinite(createdMs) ||
        !Number.isFinite(expiresMs) ||
        expiresMs <= createdMs
      ) {
        throw new Error("Ungültige Battle-Einladung. Das Postfach wurde gesperrt.");
      }
      if (expiresMs <= now) continue;
      result.push({
        id,
        senderId,
        senderDisplayName: requireStringOrNull(
          row.sender_display_name,
          "Ungültiger Anzeigename im Battle-Postfach.",
        ),
        senderAvatarUrl: requireStringOrNull(
          row.sender_avatar_url,
          "Ungültiges Profilbild im Battle-Postfach.",
        ),
        mode: requireMode(row.mode, "Ungültiger Battle-Modus."),
        durationS,
        targetReps,
        createdAt: createdAt as string,
        expiresAt: expiresAt as string,
      });
    }
    return result;
  };

  const loadSent = async (): Promise<SentBattleInvitation[]> => {
    const raw = await gateway.rpc("get_my_sent_friend_battle_invitations", {});
    const rows = requireRpcRows(
      checkResult(raw, "Gesendete Battle-Einladungen konnten nicht geladen werden."),
      "Unerwartete Antwort bei gesendeten Battle-Einladungen.",
    );
    const now = Date.now();
    const seen = new Set<string>();
    return rows.map((row) => {
      const id = requireUuid(row.invitation_id, "Ungültige gesendete Battle-Einladung.");
      const recipientId = requireUuid(row.recipient_id, "Ungültiger Empfänger.");
      const status = row.status;
      if (
        seen.has(id) ||
        typeof status !== "string" ||
        !INVITATION_STATUSES.includes(status as BattleInvitationStatus)
      ) {
        throw new Error("Ungültiger Status gesendeter Battle-Einladungen.");
      }
      seen.add(id);
      const createdAt = row.created_at;
      const expiresAt = row.expires_at;
      const respondedAt = row.responded_at;
      const createdMs = typeof createdAt === "string" ? Date.parse(createdAt) : Number.NaN;
      const expiresMs = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
      if (!Number.isFinite(createdMs) || !Number.isFinite(expiresMs) || expiresMs <= createdMs) {
        throw new Error("Ungültige Zeitangaben gesendeter Battle-Einladungen.");
      }
      const normalizedStatus =
        status === "pending" && expiresMs <= now ? "expired" : (status as BattleInvitationStatus);
      const battleId =
        row.battle_id === null ? null : requireUuid(row.battle_id, "Ungültige Battle-ID.");
      if (normalizedStatus !== "accepted" && battleId !== null) {
        throw new Error("Battle-ID passt nicht zum Einladungsstatus.");
      }
      return {
        id,
        recipientId,
        status: normalizedStatus,
        battleId,
        mode: requireMode(row.mode, "Ungültiger Battle-Modus."),
        createdAt: createdAt as string,
        expiresAt: expiresAt as string,
        respondedAt: requireStringOrNull(respondedAt, "Ungültige Antwortzeit."),
      };
    });
  };

  const loadDashboard = async (): Promise<BattleInvitationDashboard> => {
    const user = await requireRegisteredUser();
    const [friends, incoming, sent] = await Promise.all([
      loadFriends(user.id),
      loadIncoming(user.id),
      loadSent(),
    ]);
    await assertSameUser(user.id);
    return { userId: user.id, friends, incoming, sent };
  };

  return {
    enabled,
    loadDashboard,
    async sendInvitation(input) {
      const user = await requireRegisteredUser();
      if (
        !UUID_PATTERN.test(input.recipientId) ||
        !MODES.includes(input.mode) ||
        !Number.isInteger(input.durationS) ||
        input.durationS < 15 ||
        input.durationS > 600 ||
        !Number.isInteger(input.targetReps) ||
        input.targetReps < 0 ||
        input.targetReps > 500
      ) {
        throw new Error("Die Battle-Einstellungen sind ungültig.");
      }
      const friends = await loadFriends(user.id);
      if (!friends.some((friend) => friend.id === input.recipientId)) {
        throw new Error("Nur aktuell bestätigte Freunde können eingeladen werden.");
      }
      await assertSameUser(user.id);
      const result = checkResult(
        await gateway.rpc("create_friend_battle_invitation", {
          p_recipient_id: input.recipientId,
          p_mode: input.mode,
          p_duration_s: input.durationS,
          p_target_reps: input.targetReps,
        }),
        "Die Battle-Einladung konnte nicht gesendet werden.",
      );
      return requireUuid(result, "Der Server hat keine gültige Einladungs-ID zurückgegeben.");
    },
    async respondToInvitation(invitationId, senderId, accept) {
      const user = await requireRegisteredUser();
      if (!UUID_PATTERN.test(invitationId) || !UUID_PATTERN.test(senderId)) {
        return { result: "stale", battleId: null };
      }
      const [incoming, friends] = await Promise.all([loadIncoming(user.id), loadFriends(user.id)]);
      const invitation = incoming.find((item) => item.id === invitationId);
      if (
        !invitation ||
        invitation.senderId !== senderId ||
        !friends.some((friend) => friend.id === senderId) ||
        Date.parse(invitation.expiresAt) <= Date.now()
      ) {
        return { result: "stale", battleId: null };
      }
      await assertSameUser(user.id);
      const raw = await gateway.rpc("respond_to_friend_battle_invitation", {
        p_invitation_id: invitationId,
        p_accept: accept,
      });
      const rows = requireRpcRows(
        checkResult(raw, "Die Battle-Einladung konnte nicht beantwortet werden."),
        "Unerwartete Antwort beim Beantworten der Battle-Einladung.",
      );
      if (rows.length !== 1 || typeof rows[0].result !== "string") {
        return { result: "stale", battleId: null };
      }
      const result = rows[0].result;
      if (result === "accepted") {
        const battleId = rows[0].battle_id;
        if (typeof battleId !== "string" || !UUID_PATTERN.test(battleId)) {
          return { result: "stale", battleId: null };
        }
        await assertSameUser(user.id);
        return { result: "accepted", battleId };
      }
      if (result === "declined" || result === "expired" || result === "cancelled") {
        return { result, battleId: null };
      }
      return { result: "stale", battleId: null };
    },
    async cancelInvitation(invitationId) {
      const user = await requireRegisteredUser();
      if (!UUID_PATTERN.test(invitationId)) return false;
      const sent = await loadSent();
      const invitation = sent.find((item) => item.id === invitationId);
      if (
        !invitation ||
        invitation.status !== "pending" ||
        Date.parse(invitation.expiresAt) <= Date.now()
      ) {
        return false;
      }
      await assertSameUser(user.id);
      const result = checkResult(
        await gateway.rpc("cancel_my_friend_battle_invitation", {
          p_invitation_id: invitationId,
        }),
        "Die Battle-Einladung konnte nicht zurückgezogen werden.",
      );
      if (typeof result !== "boolean") throw new Error("Unerwartete Antwort beim Zurückziehen.");
      return result;
    },
    async lookupWaitingBattle(battleId, expectedFriendId) {
      const user = await requireRegisteredUser();
      if (
        !UUID_PATTERN.test(battleId) ||
        !UUID_PATTERN.test(expectedFriendId) ||
        user.id === expectedFriendId
      ) {
        return null;
      }
      const friends = await loadFriends(user.id);
      if (!friends.some((friend) => friend.id === expectedFriendId)) return null;
      const battle = checkResult(
        await gateway.getBattleById(battleId),
        "Der Battle-Warteraum konnte nicht geladen werden.",
      );
      await assertSameUser(user.id);
      const isExpectedPair =
        (battle.host_id === user.id && battle.guest_id === expectedFriendId) ||
        (battle.host_id === expectedFriendId && battle.guest_id === user.id);
      if (
        battle.id !== battleId ||
        battle.status !== "waiting" ||
        battle.is_bot ||
        !isExpectedPair
      ) {
        return null;
      }
      return { id: battle.id };
    },
  };
}

/**
 * Typed Supabase boundary for the local migration candidate. Its methods are not
 * invoked while the production gate is closed; tests use a synthetic gateway.
 */
export function createSupabaseBattleInvitationGateway(
  client: SupabaseClient<Database>,
): BattleInvitationGateway {
  return {
    async getCurrentUser() {
      const { data, error } = await client.auth.getUser();
      return {
        data: data.user ? { id: data.user.id, isAnonymous: data.user.is_anonymous === true } : null,
        error,
      };
    },
    async listFriendships(userId) {
      const { data, error } = await client
        .from("friendships")
        .select("requester_id, addressee_id, status")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      return { data: data as BattleInvitationFriendshipRow[] | null, error };
    },
    async getFriendProfiles(userIds) {
      const { data, error } = await client.rpc(
        "get_friend_public_profiles" as never,
        { p_user_ids: userIds } as never,
      );
      return { data: data as unknown as BattleInvitationProfileRow[] | null, error };
    },
    async rpc(name, args) {
      const { data, error } = await client.rpc(name as never, args as never);
      return { data: data as unknown, error };
    },
    async getBattleById(battleId) {
      const { data, error } = await client
        .from("battles")
        .select("id, code, status, host_id, guest_id, is_bot")
        .eq("id", battleId)
        .maybeSingle();
      return { data: data as BattleInvitationBattleRow | null, error };
    },
  };
}

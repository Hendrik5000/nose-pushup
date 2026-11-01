import { asRecord, asString, isUuid, type RpcError } from "./rpc";
import { BackendNotReadyError, isBackendMissing } from "./rpc";

export type PostfachKind =
  "friend_request" | "friend_accepted" | "battle_invitation" | "battle_accepted" | "missed_call";

const KINDS: readonly PostfachKind[] = [
  "friend_request",
  "friend_accepted",
  "battle_invitation",
  "battle_accepted",
  "missed_call",
];

export type PostfachItem = {
  id: string;
  kind: PostfachKind;
  fromUserId: string | null;
  refId: string | null;
  fromName: string;
  fromAvatarUrl: string | null;
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  /** battle_invitation */
  mode: string | null;
  durationS: number | null;
  targetReps: number | null;
  expiresAt: string | null;
  /** battle_accepted */
  battleId: string | null;
  /** missed_call */
  callKind: "audio" | "video" | null;
};

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parsePostfachItem(row: unknown): PostfachItem | null {
  const r = asRecord(row);
  if (!isUuid(r.id)) return null;
  const kind = (KINDS as readonly string[]).includes(String(r.kind))
    ? (r.kind as PostfachKind)
    : null;
  if (!kind) return null;
  const payload = asRecord(r.payload);
  const callKind =
    payload.call_kind === "video" ? "video" : payload.call_kind === "audio" ? "audio" : null;
  return {
    id: r.id,
    kind,
    fromUserId: isUuid(r.from_user_id) ? r.from_user_id : null,
    refId: isUuid(r.ref_id) ? r.ref_id : null,
    fromName: asString(payload.from_name) ?? "Freund",
    fromAvatarUrl: asString(payload.from_avatar_url),
    createdAt: asString(r.created_at) ?? "",
    readAt: asString(r.read_at),
    resolvedAt: asString(r.resolved_at),
    resolution: asString(r.resolution),
    mode: asString(payload.mode),
    durationS: numberOrNull(payload.duration_s),
    targetReps: numberOrNull(payload.target_reps),
    expiresAt: asString(payload.expires_at),
    battleId: isUuid(payload.battle_id) ? payload.battle_id : null,
    callKind,
  };
}

export function parsePostfachItems(rows: unknown): PostfachItem[] {
  if (!Array.isArray(rows)) return [];
  const items = rows.flatMap((row) => {
    const item = parsePostfachItem(row);
    return item ? [item] : [];
  });
  return sortPostfach(items);
}

export function sortPostfach(items: readonly PostfachItem[]): PostfachItem[] {
  return [...items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
  );
}

export function isExpired(item: PostfachItem, now: number = Date.now()): boolean {
  if (!item.expiresAt) return false;
  const t = Date.parse(item.expiresAt);
  return Number.isFinite(t) && t <= now;
}

/** Items that still need an answer (accept / decline). */
export function isActionable(item: PostfachItem, now: number = Date.now()): boolean {
  if (item.resolvedAt) return false;
  if (item.kind === "friend_request") return true;
  if (item.kind === "battle_invitation") return !isExpired(item, now);
  return false;
}

export function isUnread(item: PostfachItem, now: number = Date.now()): boolean {
  if (item.readAt) return false;
  if (item.kind === "friend_request" || item.kind === "battle_invitation")
    return isActionable(item, now);
  return true;
}

export function countUnread(items: readonly PostfachItem[], now: number = Date.now()): number {
  return items.filter((item) => isUnread(item, now)).length;
}

export function countActionable(items: readonly PostfachItem[], now: number = Date.now()): number {
  return items.filter((item) => isActionable(item, now)).length;
}

export function describePostfachItem(item: PostfachItem): { title: string; body: string } {
  switch (item.kind) {
    case "friend_request":
      return {
        title: "Freundschaftsanfrage",
        body: `${item.fromName} möchte mit dir befreundet sein.`,
      };
    case "friend_accepted":
      return { title: "Einladung angenommen", body: `${item.fromName} ist jetzt dein Freund.` };
    case "battle_invitation":
      return {
        title: "Battle-Einladung",
        body: `${item.fromName} lädt dich zu einem Liegestütz-Battle ein${describeBattleSettings(item)}.`,
      };
    case "battle_accepted":
      return { title: "Battle angenommen", body: `${item.fromName} hat dein Battle angenommen.` };
    case "missed_call":
      return {
        title: "Verpasster Anruf",
        body:
          item.callKind === "video"
            ? `${item.fromName} hat dich per Video angerufen.`
            : `${item.fromName} hat dich angerufen.`,
      };
  }
}

export function describeBattleSettings(
  item: Pick<PostfachItem, "mode" | "durationS" | "targetReps">,
): string {
  if (item.mode === "first_to" && item.targetReps)
    return ` (wer zuerst ${item.targetReps} schafft)`;
  if (item.durationS) {
    const minutes = item.durationS / 60;
    const length =
      Number.isInteger(minutes) && minutes >= 1 ? `${minutes} Min.` : `${item.durationS} Sek.`;
    return ` (${length})`;
  }
  return "";
}

export function describeResolution(item: PostfachItem): string | null {
  if (!item.resolvedAt && !item.resolution) return null;
  switch (item.resolution) {
    case "accepted":
      return "Angenommen";
    case "declined":
      return "Abgelehnt";
    case "cancelled":
      return "Zurückgezogen";
    case "expired":
      return "Abgelaufen";
    case "blocked":
      return "Nicht mehr möglich";
    default:
      return "Erledigt";
  }
}

/** Items the global listener should react to when they newly arrive. */
export function findNewItems(
  previous: ReadonlySet<string>,
  next: readonly PostfachItem[],
): PostfachItem[] {
  return next.filter((item) => !previous.has(item.id) && !item.resolvedAt);
}

export type PostfachGateway = {
  list(limit: number): PromiseLike<{ data: unknown; error: RpcError | null }>;
  markRead(ids: string[], readAt: string): PromiseLike<{ error: RpcError | null }>;
  remove(ids: string[]): PromiseLike<{ error: RpcError | null }>;
};

export const POSTFACH_PAGE_SIZE = 100;

export function createPostfachClient(gateway: PostfachGateway) {
  return {
    async list(limit: number = POSTFACH_PAGE_SIZE): Promise<PostfachItem[]> {
      const result = await gateway.list(Math.min(Math.max(1, limit), 200));
      if (result.error) {
        if (isBackendMissing(result.error)) throw new BackendNotReadyError();
        throw new Error("Das Postfach konnte nicht geladen werden.");
      }
      return parsePostfachItems(result.data);
    },
    async markRead(ids: readonly string[], now: Date = new Date()): Promise<void> {
      const valid = ids.filter(isUuid);
      if (valid.length === 0) return;
      const { error } = await gateway.markRead(valid, now.toISOString());
      if (error) {
        if (isBackendMissing(error)) throw new BackendNotReadyError();
        throw new Error("Das Postfach konnte nicht aktualisiert werden.");
      }
    },
    async remove(ids: readonly string[]): Promise<void> {
      const valid = ids.filter(isUuid);
      if (valid.length === 0) return;
      const { error } = await gateway.remove(valid);
      if (error) {
        if (isBackendMissing(error)) throw new BackendNotReadyError();
        throw new Error("Der Eintrag konnte nicht gelöscht werden.");
      }
    },
  };
}

export type PostfachClient = ReturnType<typeof createPostfachClient>;

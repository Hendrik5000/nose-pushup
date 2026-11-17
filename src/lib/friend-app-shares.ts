import {
  validateMarketplaceAuthoredManifest,
  type MarketplaceAuthoredManifest,
} from "@/lib/marketplace-authoring";

export const FRIEND_APP_SHARES_MAX = 64;

export type FriendAppShare = Readonly<{
  id: string;
  sharerId: string;
  sessionId: string;
  appName: string;
  manifest: MarketplaceAuthoredManifest;
  createdAt: string;
}>;

export type FriendAppShareInsertValues = Readonly<{
  sessionId: string;
  appName: string;
  manifest: MarketplaceAuthoredManifest;
}>;

export type FriendAppSharesGateway = {
  list(): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  insert(values: {
    session_id: string;
    app_name: string;
    manifest: unknown;
  }): PromiseLike<{ error: { message: string } | null }>;
  remove(id: string): PromiseLike<{ error: { message: string } | null }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

export function parseFriendAppShareRow(value: unknown): FriendAppShare | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const sharerId = nonEmptyString(value.sharer_id);
  const sessionId = nonEmptyString(value.session_id);
  const appName = nonEmptyString(value.app_name);
  const createdAt = nonEmptyString(value.created_at);
  if (!id || !sharerId || !sessionId || !appName || !createdAt) return null;
  let manifest: MarketplaceAuthoredManifest;
  try {
    manifest = validateMarketplaceAuthoredManifest(value.manifest);
  } catch {
    return null;
  }
  return { id, sharerId, sessionId, appName, manifest, createdAt };
}

export function parseFriendAppShareRows(value: unknown): FriendAppShare[] {
  const rows = Array.isArray(value) ? value : [];
  const byId = new Map<string, FriendAppShare>();
  for (const row of rows) {
    const share = parseFriendAppShareRow(row);
    if (share && !byId.has(share.id)) byId.set(share.id, share);
  }
  return Array.from(byId.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, FRIEND_APP_SHARES_MAX);
}

export function createFriendAppSharesClient(gateway: FriendAppSharesGateway) {
  return {
    async listShares(): Promise<FriendAppShare[]> {
      const { data, error } = await gateway.list();
      if (error) {
        throw new Error(`Freundes-Apps konnten nicht geladen werden: ${error.message}`);
      }
      return parseFriendAppShareRows(data);
    },
    async shareDraft(values: FriendAppShareInsertValues): Promise<FriendAppShare["manifest"]> {
      const manifest = validateMarketplaceAuthoredManifest(values.manifest);
      const sessionId = values.sessionId.trim();
      const appName = values.appName.trim();
      if (!sessionId || !appName) {
        throw new Error("App konnte nicht geteilt werden: Entwurf unvollständig.");
      }
      const { error } = await gateway.insert({
        session_id: sessionId,
        app_name: appName,
        manifest,
      });
      if (error) {
        throw new Error(`App konnte nicht geteilt werden: ${error.message}`);
      }
      return manifest;
    },
    async unshare(id: string): Promise<void> {
      const shareId = id.trim();
      if (!shareId) throw new Error("Teilen beenden nicht möglich: Freigabe unbekannt.");
      const { error } = await gateway.remove(shareId);
      if (error) {
        throw new Error(`Teilen konnte nicht beendet werden: ${error.message}`);
      }
    },
  };
}

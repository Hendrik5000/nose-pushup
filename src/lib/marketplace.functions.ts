import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseMarketplacePublishedVersion,
  parseMarketplacePublishedVersions,
  validateMarketplaceAuthoredManifest,
  type MarketplaceAuthoredManifest,
} from "@/lib/marketplace-authoring";
import {
  parseFeatureReleaseDigestRequest,
  parseFeatureReleaseDigestResult,
} from "@/lib/feature-release-digest";

type ServerAuthContext = {
  userId: string;
  claims: { is_anonymous?: unknown };
  supabase: {
    rpc: (name: never, args: never) => PromiseLike<{ data: unknown; error: unknown }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const keys = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key))) return false;
  return keys.every((key) => required.includes(key) || optional.includes(key));
}

export function isMarketplaceAdminIdentity(userId: unknown, isAnonymousClaim: unknown): boolean {
  return (
    typeof userId === "string" &&
    userId.trim().length > 0 &&
    isAnonymousClaim !== true &&
    isAnonymousClaim !== "true"
  );
}

export function isMarketplaceAdminRoleResult(data: unknown, error: unknown): boolean {
  return error == null && data === true;
}

async function requireMarketplaceAdmin(context: ServerAuthContext) {
  if (!isMarketplaceAdminIdentity(context.userId, context.claims.is_anonymous)) {
    throw new Error("Not authorized");
  }
  const { data, error } = await context.supabase.rpc(
    "has_global_role" as never,
    { p_role_name: "admin" } as never,
  );
  if (!isMarketplaceAdminRoleResult(data, error)) throw new Error("Not authorized");
}

function isAppId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isVersion(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 2_147_483_647
  );
}

export type MarketplacePublishRequest = Readonly<{
  manifest: MarketplaceAuthoredManifest;
  confirmed: true;
  appId?: string;
  expectedVersion?: number;
}>;

export function parseMarketplacePublishRequest(value: unknown): MarketplacePublishRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["manifest", "confirmed"], ["appId", "expectedVersion"]) ||
    value.confirmed !== true
  ) {
    throw new Error("Eine ausdrückliche Admin-Bestätigung ist erforderlich.");
  }
  const manifest = validateMarketplaceAuthoredManifest(value.manifest);
  const hasAppId = Object.hasOwn(value, "appId");
  const hasExpectedVersion = Object.hasOwn(value, "expectedVersion");
  if (hasAppId !== hasExpectedVersion) throw new Error("Ungültige Versionsangabe.");
  if (!hasAppId) return Object.freeze({ manifest, confirmed: true });
  if (!isAppId(value.appId) || !isVersion(value.expectedVersion)) {
    throw new Error("Ungültige Marketplace-App-Version.");
  }
  return Object.freeze({
    manifest,
    confirmed: true,
    appId: value.appId.toLowerCase(),
    expectedVersion: value.expectedVersion,
  });
}

function parseMarketplaceVersionRequest(value: unknown) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["appId", "version"]) ||
    !isAppId(value.appId) ||
    !isVersion(value.version)
  ) {
    throw new Error("Ungültige Marketplace-App-Version.");
  }
  return { appId: value.appId.toLowerCase(), version: value.version };
}

function parseMarketplaceRevokeRequest(value: unknown) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["appId", "confirmed"]) ||
    !isAppId(value.appId) ||
    value.confirmed !== true
  ) {
    throw new Error("Eine ausdrückliche Admin-Bestätigung ist erforderlich.");
  }
  return { appId: value.appId.toLowerCase(), confirmed: true as const };
}

function parsePublishedVersionResult(value: unknown) {
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length !== 1 || !isRecord(rows[0]))
    throw new Error("Marketplace-App ist nicht verfügbar.");
  const row = rows[0];
  if (
    !hasExactKeys(row, [
      "app_id",
      "version",
      "current_version",
      "manifest",
      "created_at",
      "can_manage",
    ]) ||
    !isAppId(row.app_id) ||
    !isVersion(row.version)
  ) {
    throw new Error("Marketplace-App ist nicht verfügbar.");
  }
  return parseMarketplacePublishedVersion(row);
}

function parsePublishResult(value: unknown) {
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length !== 1 || !isRecord(rows[0]))
    throw new Error("Veröffentlichung konnte nicht bestätigt werden.");
  const row = rows[0];
  if (
    !hasExactKeys(row, ["app_id", "version"]) ||
    !isAppId(row.app_id) ||
    !isVersion(row.version)
  ) {
    throw new Error("Veröffentlichung konnte nicht bestätigt werden.");
  }
  return Object.freeze({ appId: row.app_id.toLowerCase(), version: row.version });
}

export const publishFeatureReleaseDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseFeatureReleaseDigestRequest)
  .handler(async ({ data, context }) => {
    await requireMarketplaceAdmin(context as ServerAuthContext);
    const { data: result, error } = await context.supabase.rpc(
      "publish_feature_release_digest" as never,
      {
        p_release_key: data.releaseKey,
        p_title: data.title,
        p_body: data.body,
        p_confirmed: data.confirmed,
      } as never,
    );
    if (error) throw new Error("Feature-Digest konnte nicht ins Postfach eingereiht werden.");
    return parseFeatureReleaseDigestResult(result);
  });

export const listMarketplaceCurrentApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMarketplaceAdmin(context as ServerAuthContext);
    const { data, error } = await context.supabase.rpc(
      "list_marketplace_current_apps" as never,
      {} as never,
    );
    if (error) throw new Error("Der gemeinsame Marketplace-Katalog ist nicht verfügbar.");
    return parseMarketplacePublishedVersions(data);
  });

/** Re-checks current publication status before install, enable, update, or every launch. */
export const getMarketplaceAppVersion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMarketplaceVersionRequest)
  .handler(async ({ data, context }) => {
    await requireMarketplaceAdmin(context as ServerAuthContext);
    const { data: rows, error } = await context.supabase.rpc(
      "get_marketplace_app_version" as never,
      { p_app_id: data.appId, p_version: data.version } as never,
    );
    if (error) throw new Error("Marketplace-App-Version ist nicht verfügbar.");
    return parsePublishedVersionResult(rows);
  });

export const publishMarketplaceApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMarketplacePublishRequest)
  .handler(async ({ data, context }) => {
    await requireMarketplaceAdmin(context as ServerAuthContext);
    const { data: result, error } = await context.supabase.rpc(
      "publish_marketplace_app" as never,
      {
        p_manifest: data.manifest as never,
        p_confirmed: data.confirmed,
        p_app_id: data.appId ?? null,
        p_expected_version: data.expectedVersion ?? null,
      } as never,
    );
    if (error)
      throw new Error("Marketplace-Veröffentlichung fehlgeschlagen. Bitte Katalogstatus prüfen.");
    return parsePublishResult(result);
  });

export const revokeMarketplaceApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMarketplaceRevokeRequest)
  .handler(async ({ data, context }) => {
    await requireMarketplaceAdmin(context as ServerAuthContext);
    const { data: result, error } = await context.supabase.rpc(
      "revoke_marketplace_app" as never,
      { p_app_id: data.appId, p_confirmed: data.confirmed } as never,
    );
    if (error || result !== true)
      throw new Error("Marketplace-Eintrag konnte nicht widerrufen werden.");
    return { ok: true as const };
  });

import { scopedStorageKey } from "@/integrations/supabase/backendScope";
import {
  EMPTY_HOME_APP_HUB_SETTINGS,
  homeAppHubSettingsStorageKey,
  parseHomeAppHubSettings,
  saveHomeAppHubSettings,
  type HomeAppHubSettings,
} from "@/lib/home-app-hub";
import {
  EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  marketplacePublishedInstallStorageKey,
  parseMarketplacePublishedInstallState,
  saveMarketplacePublishedInstallState,
  type MarketplacePublishedInstallState,
} from "@/lib/marketplace-authoring";
import type { MarketplaceIconId } from "@/lib/marketplace";

export const HOME_APP_SYNC_APPLIED = "alo-home-app-account-sync-applied";
export const HOME_APP_SYNC_REQUEST = "alo-home-app-account-sync-request";
export const HOME_APP_SYNC_MAX_RECORDS = 512;
export const HOME_APP_SYNC_BUILTIN_IDS = Object.freeze([
  "mira",
  "nexus",
  "health",
  "settings",
  "admin",
  "marketplace",
  "grid-defense",
  "kupferkern",
  "areas",
  "training",
  "tools",
]);
const BUILTIN_IDS = new Set(HOME_APP_SYNC_BUILTIN_IDS);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BYTES = 262_144;
export type HomeAppSyncStorage = Pick<Storage, "getItem" | "setItem">;
export type HomeAppSyncValue = Readonly<{
  kind: "home_name" | "marketplace_install";
  app_key: string;
  name: string | null;
  version: number | null;
  enabled: boolean | null;
  deleted: boolean;
}>;
export type HomeAppSyncRecord = HomeAppSyncValue & Readonly<{ revision: number }>;
export type HomeAppSyncMetadata = Readonly<{ manifestName: string; icon: MarketplaceIconId }>;
export type HomeAppSyncContext = Readonly<{
  records: readonly HomeAppSyncRecord[];
  ownedAppIds: readonly string[];
  metadata: Readonly<Record<string, HomeAppSyncMetadata>>;
}>;
export type HomeAppSyncBackend = Readonly<{
  checkIdentity: () => Promise<boolean>;
  read: () => Promise<HomeAppSyncContext>;
  write: (value: HomeAppSyncValue, expectedRevision: number) => Promise<HomeAppSyncRecord | null>;
}>;

type LocalState = Readonly<{
  settings: HomeAppHubSettings;
  installs: MarketplacePublishedInstallState;
}>;
const recordKey = (value: Pick<HomeAppSyncValue, "kind" | "app_key">) =>
  `${value.kind}:${value.app_key}`;
const metadataKey = (id: string, version: number) => `${id}:${version}`;
export { metadataKey as homeAppSyncMetadataKey };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}
function customAppId(key: string) {
  const id = key.startsWith("marketplace:") ? key.slice(12) : "";
  return UUID.test(id) ? id : null;
}
export function isHomeAppSyncEligible(key: string, ownedIds: ReadonlySet<string>) {
  return BUILTIN_IDS.has(key) || Boolean(customAppId(key) && ownedIds.has(customAppId(key)!));
}

/** Only these seven fields may enter the account baseline; never accept grants/settings JSON. */
function parseRecords(value: unknown, allowSeedRevision = false): readonly HomeAppSyncRecord[] {
  if (!Array.isArray(value) || value.length > HOME_APP_SYNC_MAX_RECORDS) {
    throw new Error("Ungültiger oder zu großer App-Kontoabgleich.");
  }
  const seen = new Set<string>();
  return value.map((raw) => {
    if (
      !isObject(raw) ||
      !exactKeys(raw, ["kind", "app_key", "name", "version", "enabled", "deleted", "revision"]) ||
      (raw.kind !== "home_name" && raw.kind !== "marketplace_install") ||
      typeof raw.app_key !== "string" ||
      (!BUILTIN_IDS.has(raw.app_key) && !customAppId(raw.app_key)) ||
      typeof raw.deleted !== "boolean" ||
      !Number.isSafeInteger(raw.revision) ||
      (raw.revision as number) < (allowSeedRevision ? 0 : 1)
    ) {
      throw new Error("Ungültiger App-Kontodatensatz.");
    }
    let name: string | null = null;
    if (raw.kind === "home_name") {
      if (
        raw.version !== null ||
        raw.enabled !== null ||
        (raw.deleted ? raw.name !== null : typeof raw.name !== "string")
      ) {
        throw new Error("Ungültiger synchronisierter App-Name.");
      }
      if (!raw.deleted) {
        name = parseHomeAppHubSettings({
          ...EMPTY_HOME_APP_HUB_SETTINGS,
          nameOverrides: { [raw.app_key]: raw.name },
        }).nameOverrides[raw.app_key]!;
      }
    } else if (
      !customAppId(raw.app_key) ||
      raw.name !== null ||
      (raw.deleted
        ? raw.version !== null || raw.enabled !== null
        : !Number.isInteger(raw.version) ||
          (raw.version as number) < 1 ||
          (raw.version as number) > 2_147_483_647 ||
          typeof raw.enabled !== "boolean")
    ) {
      throw new Error("Ungültige synchronisierte App-Installation.");
    }
    const record = Object.freeze({
      kind: raw.kind,
      app_key: raw.app_key,
      name,
      version: raw.version as number | null,
      enabled: raw.enabled as boolean | null,
      deleted: raw.deleted,
      revision: raw.revision as number,
    });
    const key = recordKey(record);
    if (seen.has(key)) throw new Error("Doppelter App-Kontodatensatz.");
    seen.add(key);
    return record;
  });
}
export function parseHomeAppSyncRecords(value: unknown) {
  return parseRecords(value);
}
export function homeAppSyncBaselineStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Konto ist erforderlich.");
  return scopedStorageKey("alo-home-app-account-sync-v1", userId);
}
function readJson(storage: HomeAppSyncStorage, key: string): unknown | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  if (raw.length > MAX_BYTES) throw new Error("Lokale App-Daten überschreiten das Sync-Limit.");
  return JSON.parse(raw) as unknown;
}
function readLocal(storage: HomeAppSyncStorage, userId: string): LocalState {
  // Unlike UI fallback loaders, corruption must never be interpreted as a cloud deletion.
  const settings = readJson(storage, homeAppHubSettingsStorageKey(userId));
  const installs = readJson(storage, marketplacePublishedInstallStorageKey(userId));
  return {
    settings: settings === null ? EMPTY_HOME_APP_HUB_SETTINGS : parseHomeAppHubSettings(settings),
    installs:
      installs === null
        ? EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE
        : parseMarketplacePublishedInstallState(installs),
  };
}
function readBaseline(storage: HomeAppSyncStorage, userId: string) {
  const raw = readJson(storage, homeAppSyncBaselineStorageKey(userId));
  if (raw === null) return [];
  if (!isObject(raw) || !exactKeys(raw, ["schemaVersion", "records"]) || raw.schemaVersion !== 1) {
    throw new Error("Ungültiger lokaler App-Sync-Verlauf.");
  }
  return parseRecords(raw.records, true);
}
function saveBaseline(
  storage: HomeAppSyncStorage,
  userId: string,
  updates: readonly HomeAppSyncRecord[],
) {
  const records = new Map(readBaseline(storage, userId).map((row) => [recordKey(row), row]));
  for (const row of updates) {
    const previous = records.get(recordKey(row));
    if (!previous || row.revision >= previous.revision) records.set(recordKey(row), row);
  }
  const parsed = parseRecords([...records.values()], true);
  storage.setItem(
    homeAppSyncBaselineStorageKey(userId),
    JSON.stringify({ schemaVersion: 1, records: parsed }),
  );
}
function tombstone(value: Pick<HomeAppSyncValue, "kind" | "app_key">): HomeAppSyncValue {
  return {
    kind: value.kind,
    app_key: value.app_key,
    name: null,
    version: null,
    enabled: null,
    deleted: true,
  };
}
function sameValue(a: HomeAppSyncValue, b: HomeAppSyncValue) {
  return (
    a.kind === b.kind &&
    a.app_key === b.app_key &&
    a.name === b.name &&
    a.version === b.version &&
    a.enabled === b.enabled &&
    a.deleted === b.deleted
  );
}
export function projectHomeAppSyncValues(local: LocalState, ownedIds: ReadonlySet<string>) {
  const values: HomeAppSyncValue[] = [];
  for (const [app_key, name] of Object.entries(local.settings.nameOverrides)) {
    if (isHomeAppSyncEligible(app_key, ownedIds))
      values.push({
        kind: "home_name",
        app_key,
        name,
        version: null,
        enabled: null,
        deleted: false,
      });
  }
  for (const install of local.installs.installs) {
    if (ownedIds.has(install.appId))
      values.push({
        kind: "marketplace_install",
        app_key: `marketplace:${install.appId}`,
        name: null,
        version: install.version,
        enabled: install.enabled,
        deleted: false,
      });
  }
  return values;
}

export function planHomeAppAccountSync(
  local: LocalState,
  baseline: readonly HomeAppSyncRecord[],
  context: HomeAppSyncContext,
) {
  const owned = new Set(context.ownedAppIds);
  if ([...owned].some((id) => !UUID.test(id))) throw new Error("Ungültige App-Eigentümerreferenz.");
  const eligible = (row: HomeAppSyncValue) => isHomeAppSyncEligible(row.app_key, owned);
  const remote = new Map(
    parseHomeAppSyncRecords(context.records)
      .filter(eligible)
      .map((r) => [recordKey(r), r]),
  );
  const base = new Map(
    parseRecords(baseline, true)
      .filter(eligible)
      .map((r) => [recordKey(r), r]),
  );
  const current = new Map(projectHomeAppSyncValues(local, owned).map((r) => [recordKey(r), r]));
  const apply: HomeAppSyncRecord[] = [];
  const writes: { value: HomeAppSyncValue; expectedRevision: number }[] = [];
  for (const key of new Set([...remote.keys(), ...base.keys(), ...current.keys()])) {
    const r = remote.get(key),
      b = base.get(key),
      c = current.get(key);
    const value = c ?? tombstone((r ?? b)!);
    if (r && !b) {
      // An absent seed is a known empty initial device, not a deletion.
      // A value added after seeding is an explicit new local edit.
      if (c && !sameValue(c, r)) writes.push({ value: c, expectedRevision: r.revision });
      else apply.push(r);
    } else if (!r) {
      if (c || (b && !b.deleted)) writes.push({ value, expectedRevision: 0 });
    } else if (b && !sameValue(value, b)) {
      if (sameValue(value, r)) apply.push(r);
      else writes.push({ value, expectedRevision: r.revision });
    } else {
      apply.push(r);
    }
  }
  const names = { ...local.settings.nameOverrides };
  const installs = new Map(local.installs.installs.map((entry) => [entry.appId, entry]));
  for (const row of apply) {
    if (row.kind === "home_name") {
      if (row.deleted) delete names[row.app_key];
      else names[row.app_key] = row.name!;
      continue;
    }
    const id = customAppId(row.app_key)!;
    if (row.deleted) {
      installs.delete(id);
      continue;
    }
    const previous = installs.get(id);
    const metadata = context.metadata[metadataKey(id, row.version!)];
    installs.set(id, {
      ...(previous?.version === row.version ? previous : {}),
      appId: id,
      version: row.version!,
      enabled: row.enabled!,
      ...(metadata ? { manifestName: metadata.manifestName, icon: metadata.icon } : {}),
    });
  }
  return {
    settings: parseHomeAppHubSettings({ ...local.settings, nameOverrides: names }),
    installs: parseMarketplacePublishedInstallState({
      schemaVersion: 1,
      installs: [...installs.values()],
    }),
    apply,
    writes,
  };
}

/** No network failure, malformed response or stale account is an empty remote state. */
export async function synchronizeHomeAppAccount(
  storage: HomeAppSyncStorage,
  userId: string,
  backend: HomeAppSyncBackend,
  isActive: () => boolean = () => true,
) {
  const current = async () => isActive() && (await backend.checkIdentity()) && isActive();
  if (!(await current())) return { cancelled: true, changed: false, pending: 0 };
  const baselineKey = homeAppSyncBaselineStorageKey(userId);
  if (storage.getItem(baselineKey) === null) {
    const initial = readLocal(storage, userId);
    const localIds = new Set(initial.installs.installs.map(({ appId }) => appId));
    for (const key of Object.keys(initial.settings.nameOverrides)) {
      const id = customAppId(key);
      if (id) localIds.add(id);
    }
    const seeds = projectHomeAppSyncValues(initial, localIds).map((value) => ({
      ...value,
      revision: 0,
    }));
    storage.setItem(baselineKey, JSON.stringify({ schemaVersion: 1, records: seeds }));
  }
  const context = await backend.read();
  if (!(await current())) return { cancelled: true, changed: false, pending: 0 };
  // Re-read after all awaits, so edits made during a slow fetch are not lost.
  const local = readLocal(storage, userId);
  const plan = planHomeAppAccountSync(local, readBaseline(storage, userId), context);
  const settingsChanged = JSON.stringify(local.settings) !== JSON.stringify(plan.settings);
  const installsChanged = JSON.stringify(local.installs) !== JSON.stringify(plan.installs);
  // Other tabs can update localStorage even during this synchronous section.
  // Apply only remote-changed fields to the freshest cache, retaining unrelated local edits/consent.
  if (settingsChanged)
    saveHomeAppHubSettings(
      storage,
      userId,
      mergeHomeAppLocalEdit(local.settings, plan.settings, readLocal(storage, userId).settings),
    );
  if (installsChanged)
    saveMarketplacePublishedInstallState(
      storage,
      userId,
      mergeMarketplaceLocalEdit(local.installs, plan.installs, readLocal(storage, userId).installs),
    );
  saveBaseline(storage, userId, plan.apply);
  let pending = 0;
  for (const { value, expectedRevision } of plan.writes) {
    if (!(await current()))
      return {
        cancelled: true,
        changed: settingsChanged || installsChanged,
        pending: plan.writes.length,
      };
    const result = await backend.write(value, expectedRevision);
    if (!isActive())
      return { cancelled: true, changed: settingsChanged || installsChanged, pending: 1 };
    if (result === null) {
      pending += 1;
      continue;
    }
    const [checked] = parseHomeAppSyncRecords([result]);
    if (!sameValue(checked!, value) || checked!.revision <= expectedRevision) {
      throw new Error("App-Sync-Bestätigung stimmt nicht mit der Änderung überein.");
    }
    // A newer local edit made while this write awaited stays in local storage;
    // acknowledging the submitted baseline cannot overwrite it.
    saveBaseline(storage, userId, [checked!]);
  }
  return { cancelled: false, changed: settingsChanged || installsChanged, pending };
}

export function requestHomeAppAccountSync(userId: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(HOME_APP_SYNC_REQUEST, { detail: { userId } }));
}

/** Apply only the user's changed fields to the latest cache, not a stale rendered document. */
export function mergeHomeAppLocalEdit(
  previous: HomeAppHubSettings,
  next: HomeAppHubSettings,
  latest: HomeAppHubSettings,
) {
  const names = { ...latest.nameOverrides };
  for (const key of new Set([
    ...Object.keys(previous.nameOverrides),
    ...Object.keys(next.nameOverrides),
  ])) {
    if (previous.nameOverrides[key] === next.nameOverrides[key]) continue;
    if (next.nameOverrides[key] === undefined) delete names[key];
    else names[key] = next.nameOverrides[key]!;
  }
  return parseHomeAppHubSettings({
    ...latest,
    nameOverrides: names,
    order:
      JSON.stringify(previous.order) === JSON.stringify(next.order) ? latest.order : next.order,
    background:
      JSON.stringify(previous.background) === JSON.stringify(next.background)
        ? latest.background
        : next.background,
  });
}
export function mergeMarketplaceLocalEdit(
  previous: MarketplacePublishedInstallState,
  next: MarketplacePublishedInstallState,
  latest: MarketplacePublishedInstallState,
) {
  const before = new Map(previous.installs.map((row) => [row.appId, row]));
  const after = new Map(next.installs.map((row) => [row.appId, row]));
  const current = new Map(latest.installs.map((row) => [row.appId, row]));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const p = before.get(id),
      n = after.get(id),
      c = current.get(id);
    if (JSON.stringify(p) === JSON.stringify(n)) continue;
    if (!n) {
      current.delete(id);
      continue;
    }
    if (!p) {
      if (!c) current.set(id, n);
      continue;
    }
    if (!c || (c.version !== p.version && n.version === p.version)) {
      throw new Error("Die App-Installation wurde inzwischen geändert. Bitte erneut versuchen.");
    }
    if (n.version !== p.version) {
      current.set(id, n);
      continue;
    }
    const changed = { ...c };
    for (const field of [
      "enabled",
      "manifestName",
      "icon",
      "permissionsReviewVersion",
      "grantedActionIds",
    ] as const) {
      if (JSON.stringify(p[field]) === JSON.stringify(n[field])) continue;
      Object.assign(changed, { [field]: n[field] });
    }
    current.set(id, changed);
  }
  return parseMarketplacePublishedInstallState({
    schemaVersion: 1,
    installs: [...current.values()],
  });
}

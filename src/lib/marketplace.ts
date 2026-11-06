import { ALO_WORKSPACE_TOOLS, type AloWorkspaceToolId } from "./home-app-menus";
import { scopedStorageKey } from "../integrations/supabase/backendScope";

export type MarketplacePermissionId = "alo.navigate" | "alo.open-existing-tool";
export type MarketplaceIconId = "training" | "health" | "search";
export type MarketplaceRouteTarget = "/programs" | "/health";
export type MarketplaceToolTarget = Extract<AloWorkspaceToolId, "search">;

export type MarketplaceHostAction =
  | { type: "navigate"; to: MarketplaceRouteTarget }
  | { type: "open-tool"; toolId: MarketplaceToolTarget };

export type MarketplacePluginManifest = {
  id: string;
  name: string;
  version: "1.0.0";
  publisher: "Alo";
  description: string;
  icon: MarketplaceIconId;
  permissions: readonly MarketplacePermissionId[];
  action: MarketplaceHostAction;
};

/**
 * Bundled catalogue only. These records are descriptive data, never executable plugin code.
 * New entries require a source change and must use a host-registered route or capability.
 */
const BUNDLED_MARKETPLACE_CATALOG = [
  {
    id: "alo-training-programs",
    name: "Trainingsprogramme",
    version: "1.0.0",
    publisher: "Alo",
    description: "Öffnet den vorhandenen Alo-Bereich für Trainingsprogramme.",
    icon: "training",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/programs" },
  },
  {
    id: "alo-health-overview",
    name: "Gesundheitsübersicht",
    version: "1.0.0",
    publisher: "Alo",
    description: "Öffnet den vorhandenen Alo-Gesundheitsbereich.",
    icon: "health",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/health" },
  },
  {
    id: "alo-quick-search",
    name: "Alo-Suche",
    version: "1.0.0",
    publisher: "Alo",
    description: "Öffnet das bestehende Alo-Suchwerkzeug.",
    icon: "search",
    permissions: ["alo.open-existing-tool"],
    action: { type: "open-tool", toolId: "search" },
  },
] as const satisfies readonly MarketplacePluginManifest[];

export const MARKETPLACE_CATALOG: readonly MarketplacePluginManifest[] = Object.freeze(
  BUNDLED_MARKETPLACE_CATALOG.map((plugin) => {
    Object.freeze(plugin.permissions);
    Object.freeze(plugin.action);
    return Object.freeze(plugin);
  }),
);

const MARKETPLACE_PLUGIN_BY_ID = new Map<string, MarketplacePluginManifest>(
  MARKETPLACE_CATALOG.map((plugin) => [plugin.id, plugin]),
);
const KNOWN_ROUTES = new Set<MarketplaceRouteTarget>(["/programs", "/health"]);
const REGISTERED_TOOLS = new Set<AloWorkspaceToolId>(ALO_WORKSPACE_TOOLS.map(({ id }) => id));
const ALLOWED_TOOL_TARGETS = new Set<MarketplaceToolTarget>(["search"]);

export const EMPTY_MARKETPLACE_INSTALL_STATE: MarketplaceInstallState = Object.freeze({
  schemaVersion: 1,
  installedPluginIds: Object.freeze([]),
  enabledPluginIds: Object.freeze([]),
});

export type MarketplaceInstallState = {
  schemaVersion: 1;
  installedPluginIds: readonly string[];
  enabledPluginIds: readonly string[];
};

export type MarketplaceStorage = Pick<Storage, "getItem" | "setItem">;

export function isMarketplacePluginId(value: unknown): value is string {
  return typeof value === "string" && MARKETPLACE_PLUGIN_BY_ID.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function sameStringArray(value: unknown, expected: readonly string[]) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index])
  );
}

function actionMatchesCanonical(value: unknown, expected: MarketplaceHostAction) {
  if (!isRecord(value)) return false;
  if (expected.type === "navigate") {
    return (
      hasExactKeys(value, ["type", "to"]) &&
      value.type === "navigate" &&
      typeof value.to === "string" &&
      KNOWN_ROUTES.has(value.to as MarketplaceRouteTarget) &&
      value.to === expected.to
    );
  }
  return (
    hasExactKeys(value, ["type", "toolId"]) &&
    value.type === "open-tool" &&
    typeof value.toolId === "string" &&
    ALLOWED_TOOL_TARGETS.has(value.toolId as MarketplaceToolTarget) &&
    REGISTERED_TOOLS.has(value.toolId as AloWorkspaceToolId) &&
    value.toolId === expected.toolId
  );
}

/** Accept only an exact copy of one of the compiled-in manifests; never register caller-supplied data. */
export function validateMarketplaceManifest(value: unknown): MarketplacePluginManifest {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Ungültiges Alo-Plugin-Manifest.");
  }

  if (!/^alo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) {
    throw new Error("Ungültige Alo-Plugin-ID.");
  }

  const canonical = MARKETPLACE_PLUGIN_BY_ID.get(value.id);
  if (!canonical) throw new Error("Unbekannte Alo-Plugin-ID.");

  const matchesCanonical =
    hasExactKeys(value, [
      "id",
      "name",
      "version",
      "publisher",
      "description",
      "icon",
      "permissions",
      "action",
    ]) &&
    value.id === canonical.id &&
    value.name === canonical.name &&
    value.version === canonical.version &&
    value.publisher === canonical.publisher &&
    value.description === canonical.description &&
    value.icon === canonical.icon &&
    sameStringArray(value.permissions, canonical.permissions) &&
    actionMatchesCanonical(value.action, canonical.action);

  if (!matchesCanonical)
    throw new Error("Plugin-Manifest stimmt nicht mit dem Alo-Katalog überein.");
  return canonical;
}

export function getMarketplaceManifest(pluginId: unknown): MarketplacePluginManifest {
  if (typeof pluginId !== "string" || !/^alo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pluginId)) {
    throw new Error("Ungültige Alo-Plugin-ID.");
  }
  const manifest = MARKETPLACE_PLUGIN_BY_ID.get(pluginId);
  if (!manifest) throw new Error("Unbekannte Alo-Plugin-ID.");
  return manifest;
}

const ROUTE_NAMES: Record<MarketplaceRouteTarget, string> = {
  "/programs": "Trainingsprogramme",
  "/health": "Gesundheit",
};

const TOOL_NAMES: Record<MarketplaceToolTarget, string> = {
  search: "Überall suchen",
};

export function describeMarketplacePermissions(manifestInput: unknown): readonly string[] {
  const manifest = validateMarketplaceManifest(manifestInput);
  return manifest.permissions.map((permission) => {
    if (permission === "alo.navigate" && manifest.action.type === "navigate") {
      return `Öffnet nur die bestehende Alo-Seite „${ROUTE_NAMES[manifest.action.to]}“ und erst nach deinem Tippen. Keine zusätzlichen Datenrechte, Hintergrundaktionen, Netzwerk- oder KI-Aufrufe.`;
    }
    if (permission === "alo.open-existing-tool" && manifest.action.type === "open-tool") {
      return `Öffnet nur das vorhandene Alo-Werkzeug „${TOOL_NAMES[manifest.action.toolId]}“ und erst nach deinem Tippen. Keine Plugin-Hintergrundrechte oder Datenübertragung.`;
    }
    throw new Error("Plugin-Berechtigung passt nicht zur registrierten Alo-Aktion.");
  });
}

export function isMarketplaceAdminAccessGranted(value: unknown): value is true {
  return value === true;
}

export function isMarketplaceAdminForUser(
  access: { userId: string; isAdmin: boolean } | null,
  currentUserId: string,
): boolean {
  return access?.userId === currentUserId && isMarketplaceAdminAccessGranted(access.isAdmin);
}

export function runMarketplaceAdminAction(value: unknown, action: () => void): boolean {
  if (!isMarketplaceAdminAccessGranted(value)) return false;
  action();
  return true;
}

function validatePluginIds(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${name} muss eine Liste sein.`);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isMarketplacePluginId(item)) throw new Error(`${name} enthält eine unbekannte Plugin-ID.`);
    if (seen.has(item)) throw new Error(`${name} enthält eine doppelte Plugin-ID.`);
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

export function parseMarketplaceInstallState(value: unknown): MarketplaceInstallState {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "installedPluginIds", "enabledPluginIds"]) ||
    value.schemaVersion !== 1
  ) {
    throw new Error("Ungültiger lokaler Marketplace-Installationsstatus.");
  }

  const installedPluginIds = validatePluginIds(value.installedPluginIds, "Installationen");
  const enabledPluginIds = validatePluginIds(value.enabledPluginIds, "Aktivierungen");
  const installed = new Set(installedPluginIds);
  if (enabledPluginIds.some((pluginId) => !installed.has(pluginId))) {
    throw new Error("Aktivierte Plugins müssen installiert sein.");
  }

  return { schemaVersion: 1, installedPluginIds, enabledPluginIds };
}

function requireKnownPluginId(pluginId: unknown) {
  if (!isMarketplacePluginId(pluginId)) {
    if (typeof pluginId === "string" && /^alo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pluginId)) {
      throw new Error("Unbekannte Alo-Plugin-ID.");
    }
    throw new Error("Ungültige Alo-Plugin-ID.");
  }
  return pluginId;
}

export function installMarketplacePlugin(
  stateInput: unknown,
  pluginId: unknown,
): MarketplaceInstallState {
  const id = requireKnownPluginId(pluginId);
  const state = parseMarketplaceInstallState(stateInput);
  if (state.installedPluginIds.includes(id)) return state;
  return parseMarketplaceInstallState({
    ...state,
    installedPluginIds: [...state.installedPluginIds, id],
  });
}

export function enableMarketplacePlugin(
  stateInput: unknown,
  pluginId: unknown,
): MarketplaceInstallState {
  const id = requireKnownPluginId(pluginId);
  const state = parseMarketplaceInstallState(stateInput);
  if (!state.installedPluginIds.includes(id)) throw new Error("Plugin ist nicht installiert.");
  if (state.enabledPluginIds.includes(id)) return state;
  return parseMarketplaceInstallState({
    ...state,
    enabledPluginIds: [...state.enabledPluginIds, id],
  });
}

export function disableMarketplacePlugin(
  stateInput: unknown,
  pluginId: unknown,
): MarketplaceInstallState {
  const id = requireKnownPluginId(pluginId);
  const state = parseMarketplaceInstallState(stateInput);
  if (!state.installedPluginIds.includes(id)) throw new Error("Plugin ist nicht installiert.");
  return parseMarketplaceInstallState({
    ...state,
    enabledPluginIds: state.enabledPluginIds.filter((installedId) => installedId !== id),
  });
}

export function removeMarketplacePlugin(
  stateInput: unknown,
  pluginId: unknown,
): MarketplaceInstallState {
  const id = requireKnownPluginId(pluginId);
  const state = parseMarketplaceInstallState(stateInput);
  return parseMarketplaceInstallState({
    ...state,
    installedPluginIds: state.installedPluginIds.filter((installedId) => installedId !== id),
    enabledPluginIds: state.enabledPluginIds.filter((enabledId) => enabledId !== id),
  });
}

export function getEnabledMarketplaceAction(
  stateInput: unknown,
  pluginId: unknown,
): MarketplaceHostAction | null {
  const id = requireKnownPluginId(pluginId);
  const state = parseMarketplaceInstallState(stateInput);
  if (!state.installedPluginIds.includes(id) || !state.enabledPluginIds.includes(id)) return null;
  return getMarketplaceManifest(id).action;
}

export function marketplaceInstallStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Alo-Konto ist erforderlich.");
  return scopedStorageKey("alo-marketplace", userId);
}

export function loadMarketplaceInstallState(
  storage: MarketplaceStorage,
  userId: string,
): MarketplaceInstallState {
  const raw = storage.getItem(marketplaceInstallStorageKey(userId));
  if (raw === null) return EMPTY_MARKETPLACE_INSTALL_STATE;
  try {
    return parseMarketplaceInstallState(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_MARKETPLACE_INSTALL_STATE;
  }
}

export function saveMarketplaceInstallState(
  storage: MarketplaceStorage,
  userId: string,
  stateInput: unknown,
) {
  const state = parseMarketplaceInstallState(stateInput);
  storage.setItem(marketplaceInstallStorageKey(userId), JSON.stringify(state));
}

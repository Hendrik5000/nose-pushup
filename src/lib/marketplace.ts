import { ALO_WORKSPACE_TOOLS, HOME_OTHER_AREAS, type AloWorkspaceToolId } from "./home-app-menus";
import { PRIVATE_GAME_IDS, type PrivateGameId } from "./private-game-policy";
import { scopedStorageKey } from "../integrations/supabase/backendScope";

export type MarketplaceCategory = "app" | "area" | "tool";
export type MarketplacePermissionId = "alo.navigate" | "alo.open-existing-tool";
export type MarketplaceIconId =
  | "mira"
  | "nexus"
  | "health"
  | "settings"
  | "training"
  | "admin"
  | "hub"
  | "coach"
  | "inbox"
  | "game"
  | "programs"
  | "calisthenics"
  | "run"
  | "season"
  | "battle"
  | "league"
  | "leaderboard"
  | "clubs"
  | "alarm"
  | "today"
  | "search"
  | "capture"
  | "collections"
  | "shortcuts"
  | "privacy";

const MARKETPLACE_APP_ROUTES = [
  "/ai",
  "/chat",
  "/exercises",
  "/profile",
  "/training",
  "/admin",
  "/areas",
  "/tools",
  "/marketplace",
  "/coach",
  "/postfach",
] as const;

export type MarketplaceRouteTarget =
  (typeof MARKETPLACE_APP_ROUTES)[number] | (typeof HOME_OTHER_AREAS)[number]["to"];
export type MarketplaceToolTarget = AloWorkspaceToolId;
export type MarketplaceGameTarget = PrivateGameId;

export type MarketplaceHostAction =
  | { type: "navigate"; to: MarketplaceRouteTarget }
  | { type: "open-game"; gameId: MarketplaceGameTarget }
  | { type: "open-tool"; toolId: MarketplaceToolTarget };

export type MarketplacePluginManifest = {
  id: string;
  name: string;
  version: "1.0.0";
  publisher: "Alo";
  category: MarketplaceCategory;
  description: string;
  icon: MarketplaceIconId;
  permissions: readonly MarketplacePermissionId[];
  action: MarketplaceHostAction;
};

/**
 * Bundled catalogue only. These records are descriptive data, never executable plugin code.
 * New entries require a source change and must use a host-registered route, game ID, or capability.
 */
const BUNDLED_MARKETPLACE_CATALOG = [
  {
    id: "alo-mira",
    name: "Mira",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description:
      "Öffnet Miras vorhandene Seite. Eine KI-Anfrage startet erst, wenn du dort selbst eine Nachricht sendest.",
    icon: "mira",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/ai" },
  },
  {
    id: "alo-nexus-chat",
    name: "Nexus Chat",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description:
      "Öffnet den vorhandenen Nexus-Chat. Eine Nachricht wird erst durch deine eigene Sendeaktion übermittelt.",
    icon: "nexus",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/chat" },
  },
  {
    id: "alo-health-app",
    name: "Alo Health",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet die bestehende Alo-Health-App.",
    icon: "health",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/exercises" },
  },
  {
    id: "alo-settings",
    name: "Einstellungen",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet dein vorhandenes Alo-Profil und die Einstellungen.",
    icon: "settings",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/profile" },
  },
  {
    id: "alo-training",
    name: "Trainingsübersicht & Gym",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet die vorhandene Trainingsübersicht und Gym-Funktionen.",
    icon: "training",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/training" },
  },
  {
    id: "alo-admin",
    name: "Admin-Bereich",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description:
      "Öffnet den vorhandenen Admin-Bereich. Bestehende Berechtigungen für Rollenverwaltung bleiben unverändert.",
    icon: "admin",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/admin" },
  },
  {
    id: "alo-all-areas",
    name: "Weitere Bereiche",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet die vorhandene Übersicht aller weiteren Alo-Bereiche.",
    icon: "hub",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/areas" },
  },
  {
    id: "alo-workspace-tools",
    name: "Alo-Werkzeuge",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet die vorhandene Übersicht der registrierten Alo-Werkzeuge.",
    icon: "hub",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/tools" },
  },
  {
    id: "alo-marketplace",
    name: "Marketplace",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet den vorhandenen Alo Marketplace.",
    icon: "hub",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/marketplace" },
  },
  {
    id: "alo-smart-coach",
    name: "Smart Coach",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description:
      "Öffnet den vorhandenen Fitness-Coach. Eine KI-Anfrage startet erst, wenn du dort selbst eine Nachricht sendest.",
    icon: "coach",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/coach" },
  },
  {
    id: "alo-postfach",
    name: "Postfach",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet dein vorhandenes Postfach mit Einladungen und verpassten Anrufen.",
    icon: "inbox",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/postfach" },
  },
  {
    id: "alo-grid-defense",
    name: "Grid Defense",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet das vorhandene, Admin-geschützte Grid-Defense-Spiel.",
    icon: "game",
    permissions: ["alo.navigate"],
    action: { type: "open-game", gameId: "grid-defense" },
  },
  {
    id: "alo-kupferkern",
    name: "Kupferkern",
    version: "1.0.0",
    publisher: "Alo",
    category: "app",
    description: "Öffnet das vorhandene, Admin-geschützte Spiel Kupferkern.",
    icon: "game",
    permissions: ["alo.navigate"],
    action: { type: "open-game", gameId: "kupferkern" },
  },
  {
    id: "alo-health-overview",
    name: "Gesundheit",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Gesundheit und Wohlbefinden",
    icon: "health",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/health" },
  },
  {
    id: "alo-training-programs",
    name: "Programme",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Trainingsprogramme und Pläne",
    icon: "programs",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/programs" },
  },
  {
    id: "alo-calisthenics",
    name: "Calisthenics",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Kraft und Körpergewicht",
    icon: "calisthenics",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/calisthenics" },
  },
  {
    id: "alo-running",
    name: "Laufen",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Laufen und Ausdauer",
    icon: "run",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/run" },
  },
  {
    id: "alo-season",
    name: "Saison",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Deine aktuelle Saison",
    icon: "season",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/season" },
  },
  {
    id: "alo-battle",
    name: "Wettkampf",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Wettkampf und Battles",
    icon: "battle",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/battle" },
  },
  {
    id: "alo-battle-league",
    name: "Battle-Liga",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Liga und Ranglisten",
    icon: "league",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/battle-league" },
  },
  {
    id: "alo-leaderboard",
    name: "Rangliste",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Punkte und Bestenlisten",
    icon: "leaderboard",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/leaderboard" },
  },
  {
    id: "alo-clubs",
    name: "Clubs",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Gemeinsam trainieren",
    icon: "clubs",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/clubs" },
  },
  {
    id: "alo-alarm",
    name: "Wecker",
    version: "1.0.0",
    publisher: "Alo",
    category: "area",
    description: "Trainingswecker verwalten",
    icon: "alarm",
    permissions: ["alo.navigate"],
    action: { type: "navigate", to: "/alarm" },
  },
  {
    id: "alo-today",
    name: "Tagesübersicht",
    version: "1.0.0",
    publisher: "Alo",
    category: "tool",
    description: "Gespeicherte Inhalte und Aufgaben für heute ansehen.",
    icon: "today",
    permissions: ["alo.open-existing-tool"],
    action: { type: "open-tool", toolId: "today" },
  },
  {
    id: "alo-quick-search",
    name: "Überall suchen",
    version: "1.0.0",
    publisher: "Alo",
    category: "tool",
    description: "Alo-Inhalte und gespeicherte Einträge durchsuchen.",
    icon: "search",
    permissions: ["alo.open-existing-tool"],
    action: { type: "open-tool", toolId: "search" },
  },
  {
    id: "alo-quick-save",
    name: "Schnell speichern",
    version: "1.0.0",
    publisher: "Alo",
    category: "tool",
    description: "Notizen, Links und Anhänge in Alo ablegen.",
    icon: "capture",
    permissions: ["alo.open-existing-tool"],
    action: { type: "open-tool", toolId: "capture" },
  },
  {
    id: "alo-collections",
    name: "Sammlungen",
    version: "1.0.0",
    publisher: "Alo",
    category: "tool",
    description: "Gespeicherte Inhalte ordnen und wiederfinden.",
    icon: "collections",
    permissions: ["alo.open-existing-tool"],
    action: { type: "open-tool", toolId: "collections" },
  },
  {
    id: "alo-shortcuts",
    name: "Schnellaktionen",
    version: "1.0.0",
    publisher: "Alo",
    category: "tool",
    description: "Häufige Alo-Aktionen direkt starten.",
    icon: "shortcuts",
    permissions: ["alo.open-existing-tool"],
    action: { type: "open-tool", toolId: "shortcuts" },
  },
  {
    id: "alo-privacy",
    name: "Daten & Datenschutz",
    version: "1.0.0",
    publisher: "Alo",
    category: "tool",
    description: "Synchronisierung und Datenfreigaben verwalten.",
    icon: "privacy",
    permissions: ["alo.open-existing-tool"],
    action: { type: "open-tool", toolId: "privacy" },
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
const KNOWN_ROUTES = new Set<MarketplaceRouteTarget>([
  ...MARKETPLACE_APP_ROUTES,
  ...HOME_OTHER_AREAS.map(({ to }) => to),
]);
const REGISTERED_TOOLS = new Set<MarketplaceToolTarget>(ALO_WORKSPACE_TOOLS.map(({ id }) => id));
const REGISTERED_GAMES = new Set<MarketplaceGameTarget>(PRIVATE_GAME_IDS);

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
  if (expected.type === "open-game") {
    return (
      hasExactKeys(value, ["type", "gameId"]) &&
      value.type === "open-game" &&
      typeof value.gameId === "string" &&
      REGISTERED_GAMES.has(value.gameId as MarketplaceGameTarget) &&
      value.gameId === expected.gameId
    );
  }
  return (
    hasExactKeys(value, ["type", "toolId"]) &&
    value.type === "open-tool" &&
    typeof value.toolId === "string" &&
    REGISTERED_TOOLS.has(value.toolId as MarketplaceToolTarget) &&
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
      "category",
      "description",
      "icon",
      "permissions",
      "action",
    ]) &&
    value.id === canonical.id &&
    value.name === canonical.name &&
    value.version === canonical.version &&
    value.publisher === canonical.publisher &&
    value.category === canonical.category &&
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

function nameForRoute(to: MarketplaceRouteTarget) {
  return MARKETPLACE_CATALOG.find(
    (plugin) => plugin.action.type === "navigate" && plugin.action.to === to,
  )?.name;
}

function nameForGame(gameId: MarketplaceGameTarget) {
  return MARKETPLACE_CATALOG.find(
    (plugin) => plugin.action.type === "open-game" && plugin.action.gameId === gameId,
  )?.name;
}

export function describeMarketplacePermissions(manifestInput: unknown): readonly string[] {
  const manifest = validateMarketplaceManifest(manifestInput);
  const action = manifest.action;
  return manifest.permissions.map((permission) => {
    if (permission === "alo.navigate" && action.type === "navigate") {
      const name = nameForRoute(action.to) ?? action.to;
      return `Öffnet nur die vorhandene Alo-Seite „${name}“ und erst nach deinem Tippen. Keine zusätzlichen Plugin-Datenrechte oder Hintergrundaktionen; die bestehende App nutzt ihre normalen Alo-Funktionen.`;
    }
    if (permission === "alo.navigate" && action.type === "open-game") {
      const name = nameForGame(action.gameId) ?? action.gameId;
      return `Öffnet nur das vorhandene Alo-Spiel „${name}“ nach deinem Tippen. Der bestehende Admin-Schutz gilt weiter; das Plugin führt keinen eigenen Code aus.`;
    }
    if (permission === "alo.open-existing-tool" && action.type === "open-tool") {
      const name =
        ALO_WORKSPACE_TOOLS.find(({ id }) => id === action.toolId)?.label ?? action.toolId;
      return `Öffnet nur das registrierte Alo-Werkzeug „${name}“ und erst nach deinem Tippen. Keine zusätzlichen Plugin-Rechte oder Hintergrundaktionen; das Werkzeug bleibt im normalen Alo-Kontext.`;
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

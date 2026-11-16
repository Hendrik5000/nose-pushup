import {
  validateMarketplaceAuthoredManifest,
  type MarketplacePublishedInstallState,
  type MarketplacePublishedVersion,
} from "./marketplace-authoring";
import {
  getMarketplaceAuthorAction,
  isMarketplaceAdminAccessGranted,
  type MarketplaceHostAction,
} from "./marketplace";

export type MarketplaceActionRequest = Readonly<{
  appId: string;
  version: number;
  actionId: string;
}>;
export type MarketplaceActionDependencies = {
  isCurrent: () => boolean;
  checkAdmin: () => Promise<unknown>;
  loadInstalls: () => MarketplacePublishedInstallState;
  getVersion: () => Promise<Pick<MarketplacePublishedVersion, "appId" | "version" | "manifest">>;
  execute: (action: MarketplaceHostAction) => void | Promise<void>;
};

/** Every asynchronous boundary is bound to the same account, app, version and open viewer. */
export async function executeMarketplaceAppAction(
  request: MarketplaceActionRequest,
  dependencies: MarketplaceActionDependencies,
): Promise<void> {
  const assertCurrent = () => {
    if (!dependencies.isCurrent())
      throw new Error("Konto oder App geändert. Bitte die App erneut öffnen.");
  };
  assertCurrent();
  const access = await dependencies.checkAdmin();
  assertCurrent();
  if (!isMarketplaceAdminAccessGranted(access)) {
    throw new Error("Admin-Zugriff ist nicht mehr bestätigt. Die Aktion wurde blockiert.");
  }
  const findGrantedInstall = () =>
    dependencies
      .loadInstalls()
      .installs.find(
        (entry) =>
          entry.appId === request.appId &&
          entry.version === request.version &&
          entry.enabled &&
          entry.permissionsReviewVersion === request.version &&
          entry.grantedActionIds?.includes(request.actionId),
      );
  if (!findGrantedInstall())
    throw new Error("Diese Aktion ist lokal nicht freigegeben. Prüfe die App-Berechtigungen.");
  const checked = await dependencies.getVersion();
  assertCurrent();
  // A permission can be revoked or an install disabled while the server check is pending.
  if (!findGrantedInstall())
    throw new Error("Die lokale Freigabe hat sich geändert. Prüfe die App-Berechtigungen.");
  if (checked.appId !== request.appId || checked.version !== request.version) {
    throw new Error("Diese App-Version ist nicht mehr verfügbar.");
  }
  const manifest = validateMarketplaceAuthoredManifest(checked.manifest);
  const declared = manifest.blocks.some(
    (block) => block.type === "action" && block.actionId === request.actionId,
  );
  const registered = getMarketplaceAuthorAction(request.actionId);
  if (!declared || !registered) throw new Error("Die Aktion ist nicht im Alo-Host registriert.");
  assertCurrent();
  await dependencies.execute(registered.action);
}

/** Await route acceptance; an async router failure must not look like a successful launch. */
export async function dispatchMarketplaceHostAction(
  action: MarketplaceHostAction,
  host: {
    navigate: (to: string, gameId?: string) => void | Promise<void>;
    openTool: (toolId: string) => void;
    close: () => void;
  },
): Promise<void> {
  if (action.type === "navigate") {
    await host.navigate(action.to);
    host.close();
  } else if (action.type === "open-game") {
    await host.navigate("/games", action.gameId);
    host.close();
  } else {
    host.close();
    host.openTool(action.toolId);
  }
}

export function describeMarketplaceFunctionality(manifest: {
  game?: unknown;
  blocks: readonly { type: string }[];
}) {
  const actions = manifest.blocks.filter((block) => block.type === "action").length;
  const hasLocalInteractiveBlocks = manifest.blocks.some(
    (block) => block.type === "stats" || block.type === "checklist",
  );
  if (manifest.game) {
    return {
      label: "Spielbares Quiz",
      detail:
        "Antworten, Auswertung und Ergebnis laufen direkt in dieser App. Zusätzliche Alo-Ziele öffnen sich nur nach deinem Tippen.",
    };
  }
  if (hasLocalInteractiveBlocks) {
    return {
      label: "Deklarative Alo-App",
      detail: `${actions} verknüpfte Alo-Ziele. Statistiken zeigen nur feste Werte und Checklisten bleiben lokal auf diesem Gerät; eigene Formulare, Datenspeicher oder Live-Daten sind nicht enthalten.`,
    };
  }
  return {
    label: "Alo-Schnellzugriff",
    detail: `${actions} verknüpfte Alo-Ziele. Die Aktionen öffnen vorhandene Funktionen; dieser App-Typ enthält keine eigenen Formulare, Datenspeicher oder Live-Daten.`,
  };
}

export type MarketplaceChecklistStorage = Pick<Storage, "getItem" | "setItem">;

function marketplaceChecklistStorageKey(scope: string, blockIndex: number) {
  if (!scope.trim() || scope.length > 512) throw new Error("Ungültiger App-Speicherbereich.");
  if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= 12) {
    throw new Error("Ungültiger Checklisten-Block.");
  }
  return `alo-marketplace-checklist-v1:${encodeURIComponent(scope)}:${blockIndex}`;
}

/** Loads a bounded checklist snapshot scoped to one account, app version and block. */
export function loadMarketplaceChecklistProgress(
  storage: Pick<MarketplaceChecklistStorage, "getItem">,
  scope: string,
  blockIndex: number,
  itemCount: number,
): readonly boolean[] {
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 8) {
    throw new Error("Ungültige Checklisten-Größe.");
  }
  const raw = storage.getItem(marketplaceChecklistStorageKey(scope, blockIndex));
  if (!raw || raw.length > 256) {
    return Object.freeze(Array.from({ length: itemCount }, () => false));
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length > 8 ||
      parsed.some((value) => typeof value !== "boolean")
    ) {
      return Object.freeze(Array.from({ length: itemCount }, () => false));
    }
    return Object.freeze(Array.from({ length: itemCount }, (_, index) => parsed[index] === true));
  } catch {
    return Object.freeze(Array.from({ length: itemCount }, () => false));
  }
}

/** Saves only boolean completion flags; checklist text and other app data are never stored. */
export function saveMarketplaceChecklistProgress(
  storage: Pick<MarketplaceChecklistStorage, "setItem">,
  scope: string,
  blockIndex: number,
  progress: readonly boolean[],
): void {
  if (
    progress.length < 1 ||
    progress.length > 8 ||
    progress.some((value) => typeof value !== "boolean")
  ) {
    throw new Error("Ungültiger Checklisten-Fortschritt.");
  }
  storage.setItem(marketplaceChecklistStorageKey(scope, blockIndex), JSON.stringify(progress));
}

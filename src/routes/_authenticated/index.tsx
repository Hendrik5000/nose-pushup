import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import type { PrivateGameId } from "@/lib/private-game-policy";
import { HOME_OTHER_AREAS } from "@/lib/home-app-menus";
import { supabase } from "@/integrations/supabase/client";
import { PostfachBell } from "@/components/postfach/PostfachBell";
import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import { MarketplacePublishedAppViewer } from "@/components/marketplace/MarketplacePublishedAppViewer";
import { MiraHandoff } from "@/components/alo/MiraHandoff";
import { MiraVoiceChatDialog } from "@/components/mira/MiraVoiceChatDialog";
import { MiraSpark } from "@/components/mira/MiraSpark";
import {
  createBrowserSpeechRecognitionFactory,
  type MiraSpeechRecognitionLike,
} from "@/lib/mira-voice-conversation";
import { ChevronLeft, ChevronRight, Mic, Search, Trash2, Users, X } from "lucide-react";
import {
  EMPTY_HOME_APP_HUB_SETTINGS,
  HOME_BACKGROUND_PRESETS,
  HOME_DEFAULT_BACKGROUND,
  hasHomeAppDragThreshold,
  clearHomeAppName,
  forgetHomeAppPersonalization,
  loadHomeAppHubSettings,
  loadHomeBackgroundImage,
  moveHomeApp,
  moveHomeAppRelative,
  orderHomeAppIds,
  prepareHomeBackgroundImage,
  removeHomeBackgroundImage,
  saveHomeAppHubSettings,
  saveHomeBackgroundImage,
  setHomeAppName,
  setHomeBackground,
  type HomeAppHubSettings,
} from "@/lib/home-app-hub";
import {
  EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  loadMarketplacePublishedInstallState,
  marketplacePublishedInstallStorageKey,
  parseMarketplacePublishedInstallState,
  removeMarketplacePublishedApp,
  saveMarketplacePublishedInstallState,
  type MarketplacePublishedInstall,
  type MarketplacePublishedInstallState,
} from "@/lib/marketplace-authoring";
import { isMarketplaceAdminAccessGranted } from "@/lib/marketplace";
import {
  MiraComposerPressAndHold,
  MiraInlineDictationController,
} from "@/lib/mira-inline-dictation";
import "@/mira-home-overlay.css";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Alo — All in one" },
      {
        name: "description",
        content: "Alo vereint Training, Mira für Alltag und Wissen sowie Nexus Chat an einem Ort.",
      },
    ],
  }),
  component: Dashboard,
});

type HubAppRoute =
  | "/ai"
  | "/chat"
  | "/exercises"
  | "/profile"
  | "/admin"
  | "/marketplace"
  | "/training"
  | "/areas"
  | "/tools";

type HomeHubTile =
  | {
      kind: "standard";
      id: string;
      title: string;
      artwork: Exclude<HubArtworkKind, "gridDefense" | "kupferkern">;
      to: HubAppRoute;
    }
  | {
      kind: "game";
      id: string;
      title: string;
      artwork: "gridDefense" | "kupferkern";
      game: PrivateGameId;
    }
  | { kind: "marketplace"; id: string; title: string; install: MarketplacePublishedInstall };

function buildHomeHubTiles(
  canSeeAdmin: boolean,
  installs: readonly MarketplacePublishedInstall[],
): HomeHubTile[] {
  const tiles: HomeHubTile[] = [
    { kind: "standard", id: "mira", title: "Mira", artwork: "mira", to: "/ai" },
    { kind: "standard", id: "nexus", title: "Nexus Chat", artwork: "nexus", to: "/chat" },
    { kind: "standard", id: "health", title: "Alo Health", artwork: "health", to: "/exercises" },
    {
      kind: "standard",
      id: "settings",
      title: "Einstellungen",
      artwork: "settings",
      to: "/profile",
    },
  ];
  if (canSeeAdmin) {
    tiles.push(
      { kind: "standard", id: "admin", title: "Admin", artwork: "admin", to: "/admin" },
      {
        kind: "standard",
        id: "marketplace",
        title: "Marketplace",
        artwork: "marketplace",
        to: "/marketplace",
      },
      {
        kind: "game",
        id: "grid-defense",
        title: "Grid Defense",
        artwork: "gridDefense",
        game: "grid-defense",
      },
      {
        kind: "game",
        id: "kupferkern",
        title: "Kupferkern",
        artwork: "kupferkern",
        game: "kupferkern",
      },
    );
  }
  tiles.push(
    {
      kind: "standard",
      id: "areas",
      title: "Weitere Bereiche",
      artwork: "more",
      to: "/areas",
    },
    {
      kind: "standard",
      id: "training",
      title: "Trainingsübersicht & Gym",
      artwork: "training",
      to: "/training",
    },
    { kind: "standard", id: "tools", title: "Alo-Werkzeuge", artwork: "tools", to: "/tools" },
  );
  if (canSeeAdmin) {
    for (const install of installs) {
      if (!install.enabled) continue;
      tiles.push({
        kind: "marketplace",
        id: `marketplace:${install.appId}`,
        title: install.manifestName ?? `Alo-App ${install.appId.slice(0, 8)}`,
        install,
      });
    }
  }
  return tiles;
}

function HomeAppHub({
  displayName,
  avatarUrl,
}: {
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
}) {
  const { user } = Route.useRouteContext();
  const [canSeeAdmin, setCanSeeAdmin] = useState(false);
  const [installState, setInstallState] = useState<MarketplacePublishedInstallState>(
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  );
  const [marketplaceStorageError, setMarketplaceStorageError] = useState("");
  const [settings, setSettings] = useState<HomeAppHubSettings>(EMPTY_HOME_APP_HUB_SETTINGS);
  const [settingsError, setSettingsError] = useState("");
  const [isEditingHub, setIsEditingHub] = useState(false);
  const isEditingHubRef = useRef(isEditingHub);
  const [renamingAppId, setRenamingAppId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [homeStatus, setHomeStatus] = useState("");
  const [runningMarketplaceAppId, setRunningMarketplaceAppId] = useState<string | null>(null);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(null);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");
  const [activeAppMenuId, setActiveAppMenuId] = useState<string | null>(null);
  const [uninstallTargetAppId, setUninstallTargetAppId] = useState<string | null>(null);
  const [isUninstallingApp, setIsUninstallingApp] = useState(false);
  const [draggingAppId, setDraggingAppId] = useState<string | null>(null);
  const [dropTargetAppId, setDropTargetAppId] = useState<string | null>(null);
  const [dropTargetPlacement, setDropTargetPlacement] = useState<"before" | "after" | null>(null);
  const [keyboardGrabbedAppId, setKeyboardGrabbedAppId] = useState<string | null>(null);
  const longPressStartRef = useRef<
    | { kind: "app"; appId: string; pointerId: number; x: number; y: number }
    | { kind: "empty"; pointerId: number; x: number; y: number }
    | null
  >(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredAppIdRef = useRef<string | null>(null);
  const pendingHomeDragRef = useRef<{
    appId: string;
    pointerId: number;
    x: number;
    y: number;
    element: HTMLDivElement;
  } | null>(null);
  const dragSourceAppIdRef = useRef<string | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dropTargetAppIdRef = useRef<string | null>(null);
  const dropTargetPlacementRef = useRef<"before" | "after">("before");
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const initials = displayName?.trim().slice(0, 1).toUpperCase() || "?";
  const setHomeEditingMode = (next: boolean) => {
    isEditingHubRef.current = next;
    setIsEditingHub(next);
  };

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    setCanSeeAdmin(false);
    void getAdminAreaAccess()
      .then((access) => {
        if (active) setCanSeeAdmin(isMarketplaceAdminAccessGranted(access));
      })
      .catch(() => {
        if (active) setCanSeeAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    try {
      setSettings(loadHomeAppHubSettings(window.localStorage, user.id));
      setSettingsError("");
    } catch {
      setSettings(EMPTY_HOME_APP_HUB_SETTINGS);
      setSettingsError("Home-Einstellungen sind in diesem Browser nicht verfügbar.");
    }
  }, [user.id]);

  useEffect(() => {
    if (!canSeeAdmin) {
      setInstallState(EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE);
      setMarketplaceStorageError("");
      return;
    }
    const load = () => {
      try {
        setInstallState(loadMarketplacePublishedInstallState(window.localStorage, user.id));
        setMarketplaceStorageError("");
      } catch {
        setInstallState(EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE);
        setMarketplaceStorageError("Installierte Apps sind in diesem Browser nicht verfügbar.");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === marketplacePublishedInstallStorageKey(user.id)) load();
    };
    load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [canSeeAdmin, user.id]);

  const backgroundPreference = settings.background;
  const backgroundLoadKey =
    backgroundPreference.kind === "preset"
      ? `preset:${backgroundPreference.presetId}`
      : backgroundPreference.kind;

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setCustomBackgroundUrl(null);
    if (backgroundLoadKey !== "custom") return;
    void loadHomeBackgroundImage(user.id)
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setBackgroundError("Eigenes Hintergrundbild ist nicht mehr lokal vorhanden.");
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        setCustomBackgroundUrl(createdUrl);
        setBackgroundError("");
      })
      .catch(() => {
        if (active) setBackgroundError("Eigenes Hintergrundbild konnte nicht geladen werden.");
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [backgroundLoadKey, user.id]);

  const tiles = buildHomeHubTiles(canSeeAdmin, installState.installs);
  const visibleAppIds = tiles.map((tile) => tile.id);
  const orderedTiles = orderHomeAppIds(visibleAppIds, settings.order).flatMap((appId) => {
    const tile = tiles.find((candidate) => candidate.id === appId);
    return tile ? [tile] : [];
  });
  const renamingTile = orderedTiles.find((tile) => tile.id === renamingAppId) ?? null;
  const activeActionTile = orderedTiles.find((tile) => tile.id === activeAppMenuId) ?? null;
  const activeActionTitle = activeActionTile
    ? (settings.nameOverrides[activeActionTile.id] ?? activeActionTile.title)
    : "";
  const activeActionIndex = activeActionTile
    ? orderedTiles.findIndex((tile) => tile.id === activeActionTile.id)
    : -1;
  const uninstallTargetTile = orderedTiles.find((tile) => tile.id === uninstallTargetAppId) ?? null;
  const uninstallTargetTitle = uninstallTargetTile
    ? (settings.nameOverrides[uninstallTargetTile.id] ?? uninstallTargetTile.title)
    : "";
  const runningInstall = installState.installs.find(
    (entry) => entry.appId === runningMarketplaceAppId && entry.enabled,
  );
  const backgroundUrl =
    backgroundPreference.kind === "preset"
      ? (HOME_BACKGROUND_PRESETS.find(({ id }) => id === backgroundPreference.presetId)?.src ??
        null)
      : backgroundPreference.kind === "custom"
        ? customBackgroundUrl
        : null;

  const persistSettings = (next: HomeAppHubSettings, status: string) => {
    try {
      saveHomeAppHubSettings(window.localStorage, user.id, next);
      setSettings(next);
      setSettingsError("");
      setHomeStatus(status);
      return true;
    } catch {
      setSettingsError("Die Änderung konnte nicht lokal gespeichert werden.");
      return false;
    }
  };

  const persistInstallState = async (nextInput: unknown, status: string) => {
    if (!isMarketplaceAdminAccessGranted(await getAdminAreaAccess())) {
      setHomeStatus("Admin-Zugriff ist nicht mehr bestätigt. Die Änderung wurde blockiert.");
      return false;
    }
    try {
      const next = parseMarketplacePublishedInstallState(nextInput);
      saveMarketplacePublishedInstallState(window.localStorage, user.id, next);
      setInstallState(next);
      setMarketplaceStorageError("");
      setHomeStatus(status);
      return true;
    } catch {
      setMarketplaceStorageError("Die lokale App-Änderung konnte nicht gespeichert werden.");
      return false;
    }
  };

  const cancelHomeLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  useEffect(() => {
    const cancelIfMoved = (event: PointerEvent) => {
      const start = longPressStartRef.current;
      if (
        !start ||
        start.pointerId !== event.pointerId ||
        !hasHomeAppDragThreshold(start, event.clientX, event.clientY)
      ) {
        return;
      }
      cancelHomeLongPress();
    };
    const startPendingHomeTileDrag = (event: PointerEvent) => {
      const pendingDrag = pendingHomeDragRef.current;
      if (
        !isEditingHubRef.current ||
        !pendingDrag ||
        pendingDrag.pointerId !== event.pointerId ||
        !hasHomeAppDragThreshold(pendingDrag, event.clientX, event.clientY)
      ) {
        return;
      }
      pendingHomeDragRef.current = null;
      cancelHomeLongPress();
      beginHomeTileDrag(event, pendingDrag.appId, pendingDrag.element);
    };
    const cancelOnPointerEnd = (event: PointerEvent) => {
      if (longPressStartRef.current?.pointerId === event.pointerId) cancelHomeLongPress();
      if (pendingHomeDragRef.current?.pointerId === event.pointerId) {
        pendingHomeDragRef.current = null;
      }
      if (event.type === "pointercancel" && dragPointerIdRef.current === event.pointerId) {
        clearHomeTileDrag();
      }
    };
    const cancelOnLostPointerCapture = (event: PointerEvent) => {
      if (dragPointerIdRef.current === event.pointerId) clearHomeTileDrag();
    };
    const cancelOnAdditionalTouch = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || event.isPrimary) return;
      cancelHomeLongPress();
      clearHomeTileDrag();
    };
    window.addEventListener("pointerdown", cancelOnAdditionalTouch, true);
    window.addEventListener("pointermove", cancelIfMoved, true);
    window.addEventListener("pointermove", startPendingHomeTileDrag, true);
    window.addEventListener("pointerup", cancelOnPointerEnd, true);
    window.addEventListener("pointercancel", cancelOnPointerEnd, true);
    window.addEventListener("lostpointercapture", cancelOnLostPointerCapture, true);
    return () => {
      window.removeEventListener("pointerdown", cancelOnAdditionalTouch, true);
      window.removeEventListener("pointermove", cancelIfMoved, true);
      window.removeEventListener("pointermove", startPendingHomeTileDrag, true);
      window.removeEventListener("pointerup", cancelOnPointerEnd, true);
      window.removeEventListener("pointercancel", cancelOnPointerEnd, true);
      window.removeEventListener("lostpointercapture", cancelOnLostPointerCapture, true);
    };
  }, []);

  const startHomeLongPress = (event: ReactPointerEvent<HTMLDivElement>, appId: string) => {
    if (
      !event.isPrimary ||
      (event.pointerType !== "touch" && event.pointerType !== "pen") ||
      event.button !== 0
    ) {
      return;
    }
    cancelHomeLongPress();
    const start = {
      kind: "app" as const,
      appId,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    longPressStartRef.current = start;
    longPressTimerRef.current = window.setTimeout(() => {
      if (
        longPressStartRef.current?.kind !== "app" ||
        longPressStartRef.current.pointerId !== start.pointerId
      )
        return;
      longPressTriggeredAppIdRef.current = appId;
      if (pendingHomeDragRef.current?.pointerId === start.pointerId) {
        pendingHomeDragRef.current = null;
      }
      dragSourceAppIdRef.current = null;
      dragPointerIdRef.current = null;
      dropTargetAppIdRef.current = null;
      setDraggingAppId(null);
      setDropTargetAppId(null);
      setDropTargetPlacement(null);
      setActiveAppMenuId(appId);
      setHomeStatus("App-Aktionen geöffnet.");
    }, 560);
  };

  const startEmptyHomeLongPress = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest(
        'button, a, input, textarea, select, [role="button"], [contenteditable="true"], [data-home-app-id], [data-home-press-ignore]',
      )
    ) {
      return;
    }
    cancelHomeLongPress();
    const start = {
      kind: "empty" as const,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    longPressStartRef.current = start;
    longPressTimerRef.current = window.setTimeout(() => {
      if (
        longPressStartRef.current?.kind !== "empty" ||
        longPressStartRef.current.pointerId !== start.pointerId
      )
        return;
      setRenamingAppId(null);
      setKeyboardGrabbedAppId(null);
      setHomeEditingMode(!isEditingHub);
      setHomeStatus(
        isEditingHub
          ? "Home-Bearbeitung beendet."
          : "Home-Bearbeitung gestartet. Ziehe ein App-Symbol an die gewünschte Position.",
      );
    }, 560);
  };

  const suppressLongPressClick = (event: ReactMouseEvent<HTMLDivElement>, appId: string) => {
    if (longPressTriggeredAppIdRef.current !== appId) return;
    event.preventDefault();
    event.stopPropagation();
    longPressTriggeredAppIdRef.current = null;
  };

  const getHomeTileDropTargetAtPoint = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-home-app-id]");
    const appId = element?.dataset.homeAppId;
    if (!element || !appId) return null;
    const rect = element.getBoundingClientRect();
    return { appId, placement: x < rect.left + rect.width / 2 ? "before" : "after" } as const;
  };

  const beginHomeTileDrag = (
    event: Pick<PointerEvent, "pointerId" | "isPrimary" | "preventDefault">,
    appId: string,
    sourceElement: HTMLDivElement,
  ) => {
    // The primary left-button is validated on pointerdown; on pointermove, button may be -1.
    if (!event.isPrimary) return;
    event.preventDefault();
    try {
      sourceElement.setPointerCapture(event.pointerId);
    } catch {
      setHomeStatus("Das App-Symbol konnte nicht verschoben werden. Bitte erneut versuchen.");
      return;
    }
    dragSourceAppIdRef.current = appId;
    dragPointerIdRef.current = event.pointerId;
    dropTargetAppIdRef.current = appId;
    dropTargetPlacementRef.current = "before";
    setDraggingAppId(appId);
    setDropTargetAppId(appId);
    setDropTargetPlacement("before");
  };

  const moveHomeTileDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    const target = getHomeTileDropTargetAtPoint(event.clientX, event.clientY);
    if (!target || !visibleAppIds.includes(target.appId)) return;
    dropTargetAppIdRef.current = target.appId;
    dropTargetPlacementRef.current = target.placement;
    setDropTargetAppId(target.appId);
    setDropTargetPlacement(target.placement);
  };

  const clearHomeTileDrag = () => {
    pendingHomeDragRef.current = null;
    dragSourceAppIdRef.current = null;
    dragPointerIdRef.current = null;
    dropTargetAppIdRef.current = null;
    dropTargetPlacementRef.current = "before";
    setDraggingAppId(null);
    setDropTargetAppId(null);
    setDropTargetPlacement(null);
  };

  const finishHomeTileDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    const sourceId = dragSourceAppIdRef.current;
    const drop =
      getHomeTileDropTargetAtPoint(event.clientX, event.clientY) ??
      (dropTargetAppIdRef.current
        ? { appId: dropTargetAppIdRef.current, placement: dropTargetPlacementRef.current }
        : null);
    clearHomeTileDrag();
    if (!sourceId || !drop || sourceId === drop.appId) return;
    try {
      persistSettings(
        moveHomeAppRelative(settings, visibleAppIds, sourceId, drop.appId, drop.placement),
        "Home-App-Reihenfolge lokal gespeichert.",
      );
    } catch {
      setSettingsError("Diese App konnte nicht verschoben werden.");
    }
  };

  const cancelHomeTileDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current === event.pointerId) clearHomeTileDrag();
  };

  const toggleHomeEditing = () => {
    const next = !isEditingHub;
    cancelHomeLongPress();
    clearHomeTileDrag();
    setRenamingAppId(null);
    setKeyboardGrabbedAppId(null);
    setHomeEditingMode(next);
    setHomeStatus(
      next
        ? "Home-Bearbeitung gestartet. Ziehe ein App-Symbol an die gewünschte Position."
        : "Home-Bearbeitung beendet.",
    );
  };

  const handleHomeHubKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== " " && event.key !== "Enter"))
      return;
    event.preventDefault();
    toggleHomeEditing();
  };

  const handleHomeTileKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    appId: string,
    title: string,
  ) => {
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10") ||
      event.key === "F2"
    ) {
      event.preventDefault();
      setActiveAppMenuId(appId);
      return;
    }
    if (!isEditingHub) return;

    if (keyboardGrabbedAppId === appId) {
      if (event.key === "Escape" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setKeyboardGrabbedAppId(null);
        setHomeStatus(`${title} abgelegt. Die lokale Reihenfolge bleibt gespeichert.`);
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const index = orderedTiles.findIndex((tile) => tile.id === appId);
      if (index < 0 || index + delta < 0 || index + delta >= orderedTiles.length) {
        setHomeStatus(`${title} kann in diese Richtung nicht weiter verschoben werden.`);
        return;
      }
      try {
        persistSettings(
          moveHomeApp(settings, visibleAppIds, appId, delta),
          `${title} wurde lokal verschoben. Mit den Pfeiltasten weiterbewegen oder Enter ablegen.`,
        );
        setKeyboardGrabbedAppId(appId);
      } catch {
        setSettingsError("Diese App konnte nicht verschoben werden.");
      }
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setKeyboardGrabbedAppId(appId);
      setHomeStatus(`${title} aufgenommen. Mit links oder rechts verschieben, Enter ablegen.`);
    }
  };

  const saveRename = (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renamingAppId) return;
    try {
      const next = setHomeAppName(settings, renamingAppId, renameDraft);
      if (persistSettings(next, "App-Name wurde nur auf diesem Gerät gespeichert.")) {
        setRenamingAppId(null);
        setRenameDraft("");
      }
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Ungültiger App-Name.");
    }
  };

  const resetRename = () => {
    if (!renamingAppId) return;
    try {
      const next = clearHomeAppName(settings, renamingAppId);
      if (persistSettings(next, "Standardname wiederhergestellt.")) {
        setRenamingAppId(null);
        setRenameDraft("");
      }
    } catch {
      setSettingsError("Der Standardname konnte nicht wiederhergestellt werden.");
    }
  };

  const uninstallMarketplaceAppFromHome = async () => {
    if (!uninstallTargetTile || uninstallTargetTile.kind !== "marketplace" || isUninstallingApp) {
      return;
    }
    const { appId } = uninstallTargetTile.install;
    const status = `„${uninstallTargetTitle}“ wurde nur von diesem Gerät entfernt. Der Marketplace-Eintrag bleibt erhalten.`;
    setIsUninstallingApp(true);
    try {
      const removed = await persistInstallState(
        removeMarketplacePublishedApp(installState, appId),
        status,
      );
      if (!removed) return;
      try {
        const nextSettings = forgetHomeAppPersonalization(settings, uninstallTargetTile.id);
        saveHomeAppHubSettings(window.localStorage, user.id, nextSettings);
        setSettings(nextSettings);
        setSettingsError("");
      } catch {
        setSettingsError(
          "Die Installation wurde entfernt; der gespeicherte App-Name konnte nicht bereinigt werden.",
        );
      }
      setRunningMarketplaceAppId((current) => (current === appId ? null : current));
      setHomeStatus(status);
    } catch {
      setHomeStatus("Die App konnte nicht lokal entfernt werden.");
    } finally {
      setIsUninstallingApp(false);
      setUninstallTargetAppId(null);
    }
  };

  const uploadBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBackgroundBusy(true);
    setBackgroundError("");
    try {
      const image = await prepareHomeBackgroundImage(file);
      await saveHomeBackgroundImage(user.id, image);
      const next = setHomeBackground(settings, { kind: "custom" });
      if (
        persistSettings(next, "Eigenes Hintergrundbild wurde verkleinert und nur hier gespeichert.")
      ) {
        setBackgroundError("");
      }
    } catch (error) {
      setBackgroundError(
        error instanceof Error ? error.message : "Bild konnte nicht verarbeitet werden.",
      );
    } finally {
      setBackgroundBusy(false);
    }
  };

  const removeCustomBackground = async () => {
    try {
      await removeHomeBackgroundImage(user.id);
      if (
        persistSettings(
          setHomeBackground(settings, HOME_DEFAULT_BACKGROUND),
          "Eigenes Hintergrundbild lokal entfernt.",
        )
      ) {
        setBackgroundError("");
      }
    } catch {
      setBackgroundError("Eigenes Hintergrundbild konnte nicht entfernt werden.");
    }
  };

  const renderTile = (tile: HomeHubTile, title: string) => {
    if (tile.kind === "marketplace") {
      const contents = (
        <>
          <span className="relative grid aspect-square w-full max-w-[96px] place-items-center overflow-hidden rounded-[20px] border border-white/10 bg-card shadow-md">
            <MarketplaceIcon icon={tile.install.icon ?? "hub"} className="h-8 w-8 text-primary" />
          </span>
          <span className="max-w-full text-[11px] font-medium leading-tight text-foreground sm:text-xs">
            {title}
          </span>
        </>
      );
      return isEditingHub ? (
        <div className={HUB_APP_ICON_CLASS_NAME} aria-label={`${title}, Marketplace-App`}>
          {contents}
        </div>
      ) : (
        <button
          type="button"
          className={HUB_APP_ICON_CLASS_NAME}
          aria-label={`${title} öffnen`}
          onClick={() => setRunningMarketplaceAppId(tile.install.appId)}
        >
          {contents}
        </button>
      );
    }
    if (isEditingHub) {
      return (
        <div className={HUB_APP_ICON_CLASS_NAME} aria-label={`${title}, Home-App`}>
          <HubAppIconContents title={title} artwork={tile.artwork} />
        </div>
      );
    }
    if (tile.kind === "game") {
      return <HubGameAppIcon game={tile.game} title={title} artwork={tile.artwork} />;
    }
    if (tile.to === "/areas") {
      return (
        <Link
          to="/areas"
          className={`alo-tablet-home-app-action ${HUB_APP_ICON_CLASS_NAME}`}
          aria-label={`Weitere Bereiche öffnen (${HOME_OTHER_AREAS.length})`}
        >
          <HubAppIconContents title={title} artwork={tile.artwork} />
        </Link>
      );
    }
    if (tile.to === "/tools") {
      return (
        <Link
          to="/tools"
          className={`alo-tablet-home-app-action ${HUB_APP_ICON_CLASS_NAME}`}
          aria-label="Alo-Werkzeuge öffnen"
        >
          <HubAppIconContents title={title} artwork={tile.artwork} />
        </Link>
      );
    }
    return <HubAppIcon to={tile.to} title={title} artwork={tile.artwork} />;
  };

  return (
    <>
      <section
        className={`alo-tablet-home-hub mb-8${backgroundUrl ? " relative isolate overflow-hidden rounded-3xl border border-border/40 p-4 sm:p-6" : ""}`}
        aria-labelledby="app-hub-title"
        aria-describedby="home-hub-edit-help"
        tabIndex={0}
        onPointerDown={startEmptyHomeLongPress}
        onKeyDown={handleHomeHubKeyDown}
        style={
          backgroundUrl
            ? {
                backgroundImage: `url("${backgroundUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {backgroundUrl && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-background/65 backdrop-blur-[2px]"
          />
        )}
        <div className="relative z-10">
          <p id="home-hub-edit-help" className="sr-only">
            Auf Touchgeräten eine freie Stelle lange drücken, um Apps zu bearbeiten oder die
            Bearbeitung zu beenden. Mit der Tastatur diesen Startseitenbereich fokussieren und Enter
            oder Leertaste drücken. Im Bearbeitungsmodus ein App-Symbol fokussieren, Leertaste zum
            Aufnehmen und links oder rechts zum Verschieben; Enter legt ab. Für App-Aktionen lange
            drücken oder Umschalt+F10 verwenden.
          </p>
          <p id="home-app-edit-help" className="sr-only">
            Leertaste nimmt die App auf. Pfeil links oder rechts verschiebt sie lokal. Enter legt
            ab; Escape beendet das Verschieben. Umschalt+F10 oder F2 öffnet Umbenennen und lokale
            Deinstallation.
          </p>
          <header
            className="mb-7 flex items-center justify-between gap-3"
            data-home-press-ignore="true"
          >
            <h1 id="app-hub-title" className="text-2xl font-bold tracking-tight">
              Alo
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Überall suchen"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("alo-open", { detail: "search" }))
                }
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </button>
              <PostfachBell />
              <Link
                to="/profile"
                hash="profile-training"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Freunde öffnen"
                title="Freunde"
              >
                <Users className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                to="/profile"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Profil und Einstellungen öffnen"
                title="Profil und Einstellungen"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </Link>
            </div>
          </header>
          {isEditingHub && (
            <p className="mb-4 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Ziehe die App-Symbole direkt an eine neue Position. Halte eine App lange gedrückt oder
              wähle Umschalt+F10 für Aktionen. Halte eine freie Stelle erneut, um die Bearbeitung zu
              beenden.
            </p>
          )}
          <nav
            className="alo-tablet-home-apps grid w-full max-w-[520px] grid-cols-4 gap-x-3 gap-y-6"
            aria-label="Alo-Apps"
            onPointerMoveCapture={moveHomeTileDrag}
          >
            {orderedTiles.map((tile) => {
              const title = settings.nameOverrides[tile.id] ?? tile.title;
              return (
                <div
                  key={tile.id}
                  data-home-app-id={tile.id}
                  data-drop-placement={
                    dropTargetAppId === tile.id ? dropTargetPlacement : undefined
                  }
                  role={isEditingHub ? "button" : undefined}
                  tabIndex={isEditingHub ? 0 : undefined}
                  aria-label={
                    isEditingHub
                      ? `${title}. Leertaste zum Aufnehmen, Pfeiltasten zum Verschieben; lange drücken oder Umschalt+F10 für Aktionen.`
                      : undefined
                  }
                  aria-pressed={isEditingHub ? keyboardGrabbedAppId === tile.id : undefined}
                  aria-haspopup={isEditingHub ? "dialog" : undefined}
                  aria-describedby={isEditingHub ? "home-app-edit-help" : undefined}
                  className={`relative min-w-0 select-none rounded-xl transition ${isEditingHub ? "touch-none cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing" : ""} ${draggingAppId && dropTargetAppId === tile.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                  onPointerDown={(event) => {
                    startHomeLongPress(event, tile.id);
                    if (isEditingHub && event.isPrimary && event.button === 0) {
                      pendingHomeDragRef.current = {
                        appId: tile.id,
                        pointerId: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        element: event.currentTarget,
                      };
                    }
                  }}
                  onPointerUp={(event) => {
                    pendingHomeDragRef.current = null;
                    cancelHomeLongPress();
                    if (isEditingHub) finishHomeTileDrag(event);
                  }}
                  onPointerCancel={(event) => {
                    pendingHomeDragRef.current = null;
                    cancelHomeLongPress();
                    if (isEditingHub) cancelHomeTileDrag(event);
                  }}
                  onClickCapture={(event) => suppressLongPressClick(event, tile.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (
                      longPressStartRef.current?.kind === "app" &&
                      longPressStartRef.current.appId === tile.id
                    ) {
                      longPressTriggeredAppIdRef.current = tile.id;
                    }
                    setActiveAppMenuId(tile.id);
                  }}
                  onKeyDown={(event) => handleHomeTileKeyDown(event, tile.id, title)}
                >
                  {renderTile(tile, title)}
                  {draggingAppId && dropTargetAppId === tile.id && dropTargetPlacement && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-y-0 z-20 w-1 rounded-full bg-primary ${dropTargetPlacement === "before" ? "left-0" : "right-0"}`}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          {isEditingHub && (
            <div className="mt-6 max-w-xl space-y-5" data-home-press-ignore="true">
              {renamingTile && (
                <form
                  onSubmit={saveRename}
                  className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4"
                >
                  <label className="block space-y-2 text-sm font-semibold" htmlFor="home-app-name">
                    <span>{renamingTile.title} – eigener Name</span>
                    <input
                      id="home-app-name"
                      value={renameDraft}
                      maxLength={48}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      Name speichern
                    </button>
                    {settings.nameOverrides[renamingTile.id] && (
                      <button
                        type="button"
                        onClick={resetRename}
                        className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold"
                      >
                        Standardname
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRenamingAppId(null)}
                      className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold"
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>
              )}

              <section
                className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4"
                aria-label="Home-Hintergrund wählen"
              >
                <div>
                  <h2 className="text-sm font-bold">Home-Hintergrund</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Presets oder ein eigenes Bild. Eigene Bilder werden verkleinert und
                    ausschließlich lokal in diesem Browser gespeichert.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    aria-pressed={settings.background.kind === "none"}
                    onClick={() =>
                      persistSettings(
                        setHomeBackground(settings, HOME_DEFAULT_BACKGROUND),
                        "Kein Home-Hintergrundbild ausgewählt.",
                      )
                    }
                    className="min-h-20 rounded-xl border border-border bg-background p-3 text-xs font-semibold"
                  >
                    Kein Bild
                  </button>
                  {HOME_BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={
                        settings.background.kind === "preset" &&
                        settings.background.presetId === preset.id
                      }
                      onClick={() =>
                        persistSettings(
                          setHomeBackground(settings, { kind: "preset", presetId: preset.id }),
                          `${preset.label} als Home-Hintergrund gewählt.`,
                        )
                      }
                      style={{
                        backgroundImage: `linear-gradient(0deg, rgba(8,12,20,.68), rgba(8,12,20,.12)), url("${preset.src}")`,
                      }}
                      className="min-h-20 rounded-xl border border-border bg-cover bg-center p-3 text-left text-xs font-semibold text-white shadow-sm"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3 text-center text-xs font-semibold">
                    <input
                      ref={backgroundInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => void uploadBackground(event)}
                    />
                    <span>
                      {backgroundBusy ? "Bild wird verarbeitet …" : "Eigenes Bild hochladen"}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      JPEG, PNG oder WebP · max. 10 MB
                    </span>
                  </label>
                </div>
                {settings.background.kind === "custom" && (
                  <button
                    type="button"
                    onClick={() => void removeCustomBackground()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground underline underline-offset-4"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Eigenes Bild entfernen
                  </button>
                )}
                {backgroundError && (
                  <p role="alert" className="text-xs text-destructive">
                    {backgroundError}
                  </p>
                )}
              </section>
            </div>
          )}

          {(settingsError || marketplaceStorageError) && (
            <p
              role="alert"
              className="mt-4 max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              {settingsError || marketplaceStorageError}
            </p>
          )}
          <p className="sr-only" role="status" aria-live="polite">
            {homeStatus}
          </p>
        </div>
      </section>
      <Dialog
        open={activeActionTile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveAppMenuId(null);
            longPressTriggeredAppIdRef.current = null;
            cancelHomeLongPress();
          }
        }}
      >
        <DialogContent className="max-w-sm">
          {activeActionTile && (
            <>
              <DialogTitle>{activeActionTitle}</DialogTitle>
              <DialogDescription>
                {activeActionTile.kind === "marketplace"
                  ? "Der Name ist nur auf diesem Gerät geändert. Deinstallieren entfernt nur diese lokale Installation."
                  : "Der Name dieser Alo-App wird nur auf diesem Gerät geändert."}
              </DialogDescription>
              {isEditingHub && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-label={`${activeActionTitle} nach links verschieben`}
                    disabled={activeActionIndex <= 0}
                    onClick={() => {
                      try {
                        persistSettings(
                          moveHomeApp(settings, visibleAppIds, activeActionTile.id, -1),
                          "Home-App-Reihenfolge lokal gespeichert.",
                        );
                      } catch {
                        setSettingsError("Diese App konnte nicht verschoben werden.");
                      }
                      setActiveAppMenuId(null);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Nach links
                  </button>
                  <button
                    type="button"
                    aria-label={`${activeActionTitle} nach rechts verschieben`}
                    disabled={activeActionIndex < 0 || activeActionIndex >= orderedTiles.length - 1}
                    onClick={() => {
                      try {
                        persistSettings(
                          moveHomeApp(settings, visibleAppIds, activeActionTile.id, 1),
                          "Home-App-Reihenfolge lokal gespeichert.",
                        );
                      } catch {
                        setSettingsError("Diese App konnte nicht verschoben werden.");
                      }
                      setActiveAppMenuId(null);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40"
                  >
                    Nach rechts
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className={`${isEditingHub ? "mt-2" : "mt-4"} grid gap-2`}>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingAppId(activeActionTile.id);
                    setRenameDraft(
                      settings.nameOverrides[activeActionTile.id] ?? activeActionTile.title,
                    );
                    setSettingsError("");
                    setHomeEditingMode(true);
                    setActiveAppMenuId(null);
                  }}
                  className="min-h-12 rounded-xl border border-border px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Umbenennen
                </button>
                {activeActionTile.kind === "marketplace" && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAppMenuId(null);
                      setUninstallTargetAppId(activeActionTile.id);
                    }}
                    className="min-h-12 rounded-xl border border-destructive/40 px-4 text-left text-sm font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Lokal deinstallieren
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={uninstallTargetTile !== null}
        onOpenChange={(open) => {
          if (!open && !isUninstallingApp) setUninstallTargetAppId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>„{uninstallTargetTitle}“ nur lokal deinstallieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Entfernt wird nur die Installation auf diesem Gerät. Der veröffentlichte Marketplace-
              Eintrag und seine Version bleiben unverändert und können später erneut installiert
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUninstallingApp}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUninstallingApp}
              onClick={(event) => {
                event.preventDefault();
                void uninstallMarketplaceAppFromHome();
              }}
            >
              {isUninstallingApp ? "Entferne …" : "Lokal deinstallieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {runningInstall && (
        <MarketplacePublishedAppViewer
          userId={user.id}
          appId={runningInstall.appId}
          installedVersion={runningInstall.version}
          displayName={
            settings.nameOverrides[`marketplace:${runningInstall.appId}`] ??
            runningInstall.manifestName ??
            `Alo-App ${runningInstall.appId.slice(0, 8)}`
          }
          icon={runningInstall.icon ?? "hub"}
          isAdmin={canSeeAdmin}
          open={runningMarketplaceAppId !== null}
          onOpenChange={(open) => {
            if (!open) setRunningMarketplaceAppId(null);
          }}
          onInstallStateChange={persistInstallState}
          onStatus={setHomeStatus}
        />
      )}
    </>
  );
}

type HubArtworkKind =
  | "mira"
  | "nexus"
  | "health"
  | "settings"
  | "admin"
  | "gridDefense"
  | "kupferkern"
  | "more"
  | "training"
  | "tools"
  | "marketplace";

const HUB_APP_ICON_CLASS_NAME =
  "group flex w-full min-w-0 flex-col items-center gap-2 rounded-xl text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function HubAppIcon({
  to,
  title,
  artwork,
}: {
  to: "/ai" | "/chat" | "/exercises" | "/profile" | "/admin" | "/training" | "/marketplace";
  title: string;
  artwork: Exclude<HubArtworkKind, "gridDefense" | "kupferkern">;
}) {
  return (
    <Link to={to} aria-label={`${title} öffnen`} className={HUB_APP_ICON_CLASS_NAME}>
      <HubAppIconContents title={title} artwork={artwork} />
    </Link>
  );
}

function HubGameAppIcon({
  game,
  title,
  artwork,
}: {
  game: PrivateGameId;
  title: string;
  artwork: "gridDefense" | "kupferkern";
}) {
  return (
    <Link
      to="/games"
      search={{ game }}
      aria-label={`${title} öffnen`}
      className={HUB_APP_ICON_CLASS_NAME}
    >
      <HubAppIconContents title={title} artwork={artwork} />
    </Link>
  );
}

function HubAppIconContents({ title, artwork }: { title: string; artwork: HubArtworkKind }) {
  return (
    <>
      <span className="relative grid aspect-square w-full max-w-[96px] place-items-center overflow-hidden rounded-[20px] border border-white/10 bg-card shadow-md transition group-hover:scale-105 group-hover:shadow-lg">
        <HubArtwork kind={artwork} />
      </span>
      <span className="max-w-full text-[11px] font-medium leading-tight text-foreground sm:text-xs">
        {title}
      </span>
    </>
  );
}

function HubArtwork({ kind }: { kind: HubArtworkKind }) {
  const palettes = {
    mira: { bg: "#211c37", accent: "#c4b5fd", glow: "#8b5cf6" },
    nexus: { bg: "#122d3a", accent: "#67e8f9", glow: "#0ea5e9" },
    health: { bg: "#15352e", accent: "#86efac", glow: "#10b981" },
    settings: { bg: "#3a2e1e", accent: "#fcd34d", glow: "#f59e0b" },
    admin: { bg: "#182b3b", accent: "#a5d8ff", glow: "#38bdf8" },
    gridDefense: { bg: "#152b32", accent: "#a7f3d0", glow: "#22c55e" },
    kupferkern: { bg: "#38251c", accent: "#fdba74", glow: "#c2410c" },
    more: { bg: "#172735", accent: "#67e8f9", glow: "#0ea5e9" },
    training: { bg: "#30291d", accent: "#fcd34d", glow: "#f59e0b" },
    tools: { bg: "#25233a", accent: "#c4b5fd", glow: "#8b5cf6" },
    marketplace: { bg: "#32261c", accent: "#fdba74", glow: "#ea580c" },
  } as const;
  const palette = palettes[kind];

  return (
    <svg
      viewBox="74 0 132 132"
      className="block h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="280" height="132" rx="18" fill={palette.bg} />
      <circle cx="232" cy="28" r="47" fill={palette.glow} opacity=".18" />
      <circle cx="35" cy="112" r="54" fill={palette.accent} opacity=".08" />
      {kind === "mira" && (
        <>
          <ellipse
            cx="140"
            cy="68"
            rx="64"
            ry="24"
            fill="none"
            stroke={palette.accent}
            strokeOpacity=".48"
            strokeWidth="2"
            transform="rotate(-18 140 68)"
          />
          <ellipse
            cx="140"
            cy="68"
            rx="42"
            ry="53"
            fill="none"
            stroke={palette.accent}
            strokeOpacity=".28"
            strokeWidth="2"
            transform="rotate(28 140 68)"
          />
          <circle cx="140" cy="66" r="20" fill={palette.glow} />
          <path d="m140 39 4 13 13 4-13 4-4 13-4-13-13-4 13-4 4-13Z" fill="#fff" />
          <circle cx="196" cy="38" r="4" fill="#fff" />
          <circle cx="82" cy="93" r="3" fill={palette.accent} />
        </>
      )}
      {kind === "nexus" && (
        <>
          <path
            d="M74 42h83a14 14 0 0 1 14 14v25a14 14 0 0 1-14 14h-8l-17 15V95H74a14 14 0 0 1-14-14V56a14 14 0 0 1 14-14Z"
            fill={palette.accent}
            opacity=".95"
          />
          <path
            d="M135 27h69a13 13 0 0 1 13 13v18a13 13 0 0 1-13 13h-9v14l-17-14h-43a13 13 0 0 1-13-13V40a13 13 0 0 1 13-13Z"
            fill="#e0f2fe"
            opacity=".94"
          />
          <circle cx="91" cy="68" r="4" fill="#123047" />
          <circle cx="110" cy="68" r="4" fill="#123047" />
          <circle cx="129" cy="68" r="4" fill="#123047" />
          <path d="M159 49h37" stroke="#0c4a6e" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M159 58h25"
            stroke="#0c4a6e"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".55"
          />
        </>
      )}
      {kind === "health" && (
        <>
          <circle cx="140" cy="67" r="43" fill={palette.glow} opacity=".32" />
          <path
            d="M140 96 101 60a24 24 0 0 1 36-32l3 4 3-4a24 24 0 0 1 36 32l-39 36Z"
            fill={palette.accent}
          />
          <path
            d="M70 72h31l10-17 16 35 13-25 10 13h60"
            fill="none"
            stroke="#123b2e"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="209" cy="39" r="5" fill="#fff" opacity=".85" />
        </>
      )}
      {kind === "settings" && (
        <>
          <circle cx="140" cy="66" r="42" fill={palette.glow} opacity=".28" />
          <path
            d="M140 34a8 8 0 0 1 8 8v4a23 23 0 0 1 8 4l4-2a8 8 0 0 1 11 3l4 7a8 8 0 0 1-3 11l-4 2a24 24 0 0 1 0 9l4 2a8 8 0 0 1 3 11l-4 7a8 8 0 0 1-11 3l-4-2a23 23 0 0 1-8 4v4a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8v-4a23 23 0 0 1-8-4l-4 2a8 8 0 0 1-11-3l-4-7a8 8 0 0 1 3-11l4-2a24 24 0 0 1 0-9l-4-2a8 8 0 0 1-3-11l4-7a8 8 0 0 1 11-3l4 2a23 23 0 0 1 8-4v-4a8 8 0 0 1 8-8h8Z"
            fill={palette.accent}
            transform="translate(0 -7) scale(.92 1) translate(12 0)"
          />
          <circle cx="140" cy="66" r="18" fill={palette.bg} />
          <circle cx="140" cy="66" r="8" fill={palette.accent} />
          <path
            d="M202 43h23M213.5 31.5v23"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".8"
          />
        </>
      )}
      {kind === "admin" && (
        <>
          <path
            d="M140 28 185 45v28c0 26-18 44-45 58-27-14-45-32-45-58V45l45-17Z"
            fill={palette.accent}
            opacity=".92"
          />
          <path
            d="m120 70 14 14 28-30"
            fill="none"
            stroke={palette.bg}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "gridDefense" && (
        <>
          <path
            d="M88 42h104M88 66h104M88 90h104M108 34v72M140 34v72M172 34v72"
            stroke={palette.accent}
            strokeOpacity=".28"
            strokeWidth="2"
          />
          <path d="M119 90V68h42v22Z" fill={palette.glow} opacity=".72" />
          <path d="M129 68V54l11-20 11 20v14Z" fill={palette.accent} />
          <path
            d="M140 44v12m-6-6h12"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".92"
          />
        </>
      )}
      {kind === "kupferkern" && (
        <>
          <path
            d="M88 43h24l13 23h30l13-23h24M88 89h24l13-23h30l13 23h24"
            fill="none"
            stroke={palette.accent}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".72"
          />
          <circle cx="140" cy="66" r="29" fill={palette.glow} opacity=".25" />
          <circle cx="140" cy="66" r="18" fill={palette.glow} />
          <circle cx="140" cy="66" r="8" fill={palette.accent} />
          <circle cx="140" cy="66" r="3" fill="#fff" />
        </>
      )}
      {kind === "more" && (
        <>
          <circle cx="140" cy="66" r="43" fill={palette.glow} opacity=".28" />
          <path
            d="M140 39v54M113 66h54"
            stroke={palette.accent}
            strokeWidth="12"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === "training" && (
        <>
          <circle cx="140" cy="66" r="43" fill={palette.glow} opacity=".25" />
          <path
            d="M104 54v24m12-33v42m48-42v42m12-33v24M116 66h48"
            fill="none"
            stroke={palette.accent}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "tools" && (
        <>
          <circle cx="140" cy="66" r="44" fill={palette.glow} opacity=".24" />
          <path
            d="M104 54h72a8 8 0 0 1 8 8v37a8 8 0 0 1-8 8h-72a8 8 0 0 1-8-8V62a8 8 0 0 1 8-8Z"
            fill={palette.accent}
          />
          <path
            d="M124 54V44a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8v10m-60 20h88m-52 0v12h16V74"
            fill="none"
            stroke={palette.bg}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="184" cy="37" r="4" fill="#fff" opacity=".9" />
        </>
      )}
      {kind === "marketplace" && (
        <>
          <circle cx="140" cy="68" r="45" fill={palette.glow} opacity=".24" />
          <path d="M108 53h64l6 57h-76l6-57Z" fill={palette.accent} />
          <path
            d="M126 53v-9a14 14 0 0 1 28 0v9"
            fill="none"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path d="M124 78h32" stroke={palette.bg} strokeWidth="5" strokeLinecap="round" />
          <circle cx="140" cy="92" r="7" fill={palette.glow} />
        </>
      )}
      <path d="M18 18h22" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MiraOverlayLauncher() {
  const { user } = Route.useRouteContext();
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [handoffRequest, setHandoffRequest] = useState<{ id: number; text: string } | null>(null);
  const recognitionRef = useRef<MiraSpeechRecognitionLike | null>(null);
  const inlineDictationRef = useRef<MiraInlineDictationController | null>(null);
  const pressAndHoldRef = useRef<MiraComposerPressAndHold | null>(null);
  const holdTriggeredRef = useRef(false);
  const canceledPointerIdRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const handoffIdRef = useRef(0);

  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true;
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 0);
  }, []);

  const stopListening = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Recognition may already have ended.
      }
    }
    setListening(false);
  };

  const startListening = () => {
    const recognitionFactory = createBrowserSpeechRecognitionFactory();
    const recognition = recognitionFactory?.();
    if (!recognition) {
      setVoiceError("Spracherkennung wird in diesem Browser nicht unterstützt.");
      return;
    }

    setVoiceError(null);
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const recognized = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (recognized)
        setTranscript((previous) => (previous ? `${previous} ${recognized}` : recognized));
    };
    recognition.onerror = (event) => {
      const message =
        event?.error === "not-allowed" || event?.error === "service-not-allowed"
          ? "Mikrofonzugriff wurde nicht erlaubt. Prüfe die Browser-Berechtigung und tippe erneut."
          : event?.error === "audio-capture"
            ? "Kein verwendbares Mikrofon gefunden. Prüfe dein Gerät und versuche es erneut."
            : event?.error === "no-speech"
              ? "Es wurde keine Sprache erkannt. Tippe auf das Mikrofon und versuche es erneut."
              : "Spracherkennung fehlgeschlagen. Versuche es erneut oder nutze den Textbereich.";
      setVoiceError(message);
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError(
        "Das Mikrofon konnte nicht gestartet werden. Prüfe die Berechtigung und versuche es erneut.",
      );
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      stopListening();
      inlineDictationRef.current?.cancel();
      setInterimTranscript("");
    } else setVoiceError(null);
    setOpen(nextOpen);
  };

  const continueToMira = () => {
    if (listening) {
      stopListening();
      inlineDictationRef.current?.stop();
      setVoiceError(
        "Diktat beendet. Prüfe den erkannten Text und tippe danach erneut auf die Übergabe.",
      );
      return;
    }
    const text = transcript.trim();
    if (!text) return;
    stopListening();
    inlineDictationRef.current?.cancel();
    setOpen(false);
    handoffIdRef.current += 1;
    setHandoffRequest({ id: handoffIdRef.current, text });
  };

  useEffect(() => {
    const recognitionFactory = createBrowserSpeechRecognitionFactory();
    const inlineDictation = new MiraInlineDictationController({
      createRecognition: () => recognitionFactory?.() ?? null,
      onTranscript: (recognized) =>
        setTranscript((previous) => (previous ? `${previous} ${recognized}` : recognized)),
      onInterimTranscript: setInterimTranscript,
      onListeningChange: setListening,
      onError: setVoiceError,
    });
    inlineDictationRef.current = inlineDictation;
    const pressAndHold = new MiraComposerPressAndHold(
      () => {
        holdTriggeredRef.current = true;
        setVoiceError(null);
        setTranscript("");
        setInterimTranscript("");
        inlineDictation.start();
      },
      () => {
        if (!holdTriggeredRef.current) return;
        holdTriggeredRef.current = false;
        inlineDictation.stop();
        setInterimTranscript("");
        setOpen(true);
        suppressNextClick();
      },
      () => {
        if (!holdTriggeredRef.current) return;
        holdTriggeredRef.current = false;
        inlineDictation.cancel();
        setInterimTranscript("");
        setVoiceError(null);
        suppressNextClick();
      },
    );
    pressAndHoldRef.current = pressAndHold;
    return () => {
      pressAndHold.reset();
      canceledPointerIdRef.current = null;
      inlineDictation.dispose();
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition may already have ended.
      }
      recognitionRef.current = null;
      inlineDictationRef.current = null;
      pressAndHoldRef.current = null;
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
    };
  }, [suppressNextClick]);

  return (
    <>
      <div className={`alo-mira-home-launcher${handoffRequest ? " has-handoff" : ""}`}>
        <p id="home-mira-hold-disclosure" className="sr-only">
          Halte die Mira-Schaltfläche, um zu diktieren; loslassen beendet die Aufnahme. Je nach
          Browser kann Sprache über einen Browser-Dienst erkannt werden. Der Text wird erst nach
          deiner Prüfung und einem eigenen Tipp an Mira übergeben.
        </p>
        {(listening || interimTranscript) && (
          <div className="alo-mira-home-live-transcript" role="status" aria-live="polite">
            <span className="flex items-center gap-2 font-semibold">
              <Mic className="h-4 w-4" aria-hidden="true" />
              {listening ? "Sprich jetzt · loslassen beendet" : "Erkannt"}
            </span>
            {(transcript || interimTranscript) && (
              <span className="mt-1 block font-normal">
                {transcript}
                {transcript && interimTranscript ? " " : ""}
                <span className="text-muted-foreground">{interimTranscript}</span>
              </span>
            )}
          </div>
        )}
        {handoffRequest ? (
          <div className="alo-mira-home-handoff-actions">
            <MiraHandoff
              key={handoffRequest.id}
              userId={user.id}
              text={handoffRequest.text}
              source="deine eingesprochene Frage"
              label="Frage in Mira prüfen"
              className="alo-mira-home-handoff-button"
              onNavigate={() => {
                setHandoffRequest(null);
                setTranscript("");
              }}
            />
            <button
              type="button"
              className="alo-mira-home-handoff-dismiss"
              aria-label="Diktierte Frage verwerfen"
              onClick={() => {
                setHandoffRequest(null);
                setTranscript("");
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="alo-mira-home-launcher-button"
            aria-label="Mira öffnen oder halten, um eine Frage zu diktieren"
            aria-describedby="home-mira-hold-disclosure"
            title="Tippen öffnet den Diktierdialog. Halten startet die Aufnahme; loslassen beendet sie."
            aria-haspopup="dialog"
            aria-expanded={open}
            onPointerDown={(event) => {
              if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
              canceledPointerIdRef.current = null;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Pointer capture is not supported in every browser.
              }
              pressAndHoldRef.current?.pointerDown(
                event.pointerId,
                event.clientX,
                event.clientY,
                event.isPrimary,
              );
            }}
            onPointerMove={(event) => {
              if (
                pressAndHoldRef.current?.pointerMove(event.pointerId, event.clientX, event.clientY)
              ) {
                canceledPointerIdRef.current = event.pointerId;
              }
            }}
            onPointerUp={(event) => {
              const wasCanceled = canceledPointerIdRef.current === event.pointerId;
              canceledPointerIdRef.current = null;
              pressAndHoldRef.current?.pointerUp(event.pointerId);
              if (wasCanceled) suppressNextClick();
            }}
            onPointerCancel={(event) => {
              if (pressAndHoldRef.current?.pointerCancel(event.pointerId)) {
                canceledPointerIdRef.current = event.pointerId;
                suppressNextClick();
              }
            }}
            onLostPointerCapture={(event) => {
              if (pressAndHoldRef.current?.pointerCancel(event.pointerId)) {
                canceledPointerIdRef.current = event.pointerId;
                suppressNextClick();
              }
            }}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                if (suppressClickTimerRef.current !== null) {
                  window.clearTimeout(suppressClickTimerRef.current);
                  suppressClickTimerRef.current = null;
                }
                return;
              }
              handleOpenChange(true);
            }}
          >
            <MiraSpark />
          </button>
        )}
      </div>
      <MiraVoiceChatDialog
        open={open}
        onOpenChange={handleOpenChange}
        transcript={transcript}
        onTranscriptChange={setTranscript}
        listening={listening}
        onStartListening={startListening}
        onStopListening={stopListening}
        error={voiceError}
        onContinue={continueToMira}
        continueLabel="Frage in Mira prüfen"
        className="alo-dialog alo-mira-voice-entry-dialog max-h-[88dvh] overflow-y-auto sm:max-w-md"
      />
    </>
  );
}

type HomeProfile = { display_name: string | null; avatar_url: string | null };

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  useEffect(() => {
    let active = true;
    setProfile(null);
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      let current = data;
      if (!current) {
        const { data: created } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            display_name:
              (user.user_metadata?.display_name as string | undefined) ??
              (user.is_anonymous ? "Gast" : (user.email?.split("@")[0] ?? null)),
          })
          .select("display_name, avatar_url")
          .maybeSingle();
        if (!active) return;
        current = created;
      }
      setProfile(current);
    })();
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <main className="alo-tablet-home-page relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pt-6 pb-24">
      <HomeAppHub
        key={user.id}
        displayName={profile?.display_name}
        avatarUrl={profile?.avatar_url}
      />
      <MiraOverlayLauncher />
    </main>
  );
}

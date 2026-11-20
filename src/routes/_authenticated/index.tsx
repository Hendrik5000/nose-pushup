import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import type { PublicGameId } from "@/lib/public-game-policy";
import { HOME_OTHER_AREAS } from "@/lib/home-app-menus";
import { useHomeAppAccountSync } from "@/hooks/use-home-app-account-sync";
import {
  HOME_APP_SYNC_APPLIED,
  mergeHomeAppLocalEdit,
  mergeMarketplaceLocalEdit,
  requestHomeAppAccountSync,
} from "@/lib/home-app-account-sync";
import { homeDayGreeting, loadRecentHomeAppIds, rememberHomeAppOpen } from "@/lib/home-recent-apps";
import {
  aiStatusFromProviders,
  formatDailyGoalLine,
  formatHealthTodayParts,
  formatPostfachContextLine,
  formatStreakLine,
  formatWeeklyWorkoutLine,
  hasMeasuredHealthToday,
  shouldOfferChatSummary,
  type HomeAiStatus,
} from "@/lib/home-day-widgets";
import { SUPER_TOOLS } from "@/lib/super-ai-tools";
import { loadProviders } from "@/lib/ai-providers";
import { useHomeDayData } from "@/hooks/useHomeDayData";
import { useNexusUnread } from "@/hooks/useNexusUnread";
import { AloErrorBoundary } from "@/components/AloErrorBoundary";
import { PostfachBell } from "@/components/postfach/PostfachBell";
import { usePostfach } from "@/components/postfach/PostfachProvider";
import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import { MarketplacePublishedAppViewer } from "@/components/marketplace/MarketplacePublishedAppViewer";
import { MiraHandoff } from "@/components/alo/MiraHandoff";
import { MiraVoiceChatDialog } from "@/components/mira/MiraVoiceChatDialog";
import { MiraSpark } from "@/components/mira/MiraSpark";
import {
  createBrowserSpeechRecognitionFactory,
  type MiraSpeechRecognitionLike,
} from "@/lib/mira-voice-conversation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Mic,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  addHomeWidget,
  EMPTY_HOME_APP_HUB_SETTINGS,
  HOME_APP_TILE_SIZE_CLASS_NAMES,
  HOME_APP_TILE_SIZE_LABELS,
  HOME_APP_TILE_SIZES,
  HOME_BACKGROUND_PRESETS,
  HOME_DEFAULT_BACKGROUND,
  HOME_WIDGET_CATALOG,
  HOME_WIDGET_SIZE_CLASS_NAMES,
  HOME_WIDGET_SIZE_LABELS,
  hasHomeAppDragThreshold,
  moveHomeWidget,
  clearHomeAppName,
  forgetHomeAppPersonalization,
  homeAppHubSettingsStorageKey,
  loadHomeAppHubSettings,
  loadHomeBackgroundImage,
  moveHomeApp,
  moveHomeAppRelative,
  orderHomeAppIds,
  prepareHomeBackgroundImage,
  removeHomeBackgroundImage,
  saveHomeAppHubSettings,
  removeHomeWidget,
  saveHomeBackgroundImage,
  setHomeAppName,
  setHomeAppTileSize,
  setHomeBackground,
  setHomeWidgetSize,
  toggleHomeAppFavorite,
  toggleHomeAppGroupCollapsed,
  type HomeAppHubSettings,
  type HomeAppTileSize,
  type HomeWidgetId,
  type HomeWidgetSize,
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
import {
  EMPTY_MARKETPLACE_INSTALL_STATE,
  isMarketplaceAdminAccessGranted,
  loadMarketplaceInstallState,
  marketplaceInstallStorageKey,
  MARKETPLACE_CATALOG,
  removeMarketplacePlugin,
  saveMarketplaceInstallState,
  type MarketplaceHostAction,
  type MarketplaceIconId,
  type MarketplaceInstallState,
} from "@/lib/marketplace";
import {
  MiraComposerPressAndHold,
  MiraInlineDictationController,
} from "@/lib/mira-inline-dictation";
import { currentMiraSession, handoffToMira, readMiraDraft } from "@/lib/mira-handoff";
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
  | "/tools"
  | "/browser";

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
      artwork: "gridDefense" | "kupferkern" | "neonStarfighter" | "chess";
      game: PublicGameId;
    }
  | { kind: "marketplace"; id: string; title: string; install: MarketplacePublishedInstall }
  | {
      kind: "plugin";
      id: string;
      title: string;
      icon: MarketplaceIconId;
      action: MarketplaceHostAction;
    };

function buildHomeHubTiles(
  canSeeAdmin: boolean,
  installs: readonly MarketplacePublishedInstall[],
  pluginState: MarketplaceInstallState,
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
    tiles.push({
      kind: "standard",
      id: "admin",
      title: "Admin",
      artwork: "admin",
      to: "/admin",
    });
  }
  tiles.push({
    kind: "standard",
    id: "marketplace",
    title: "Marketplace",
    artwork: "marketplace",
    to: "/marketplace",
  });
  tiles.push(
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
    {
      kind: "game",
      id: "neon-starfighter",
      title: "Neon Starfighter",
      artwork: "neonStarfighter",
      game: "neon-starfighter",
    },
    {
      kind: "game",
      id: "chess",
      title: "Alo Schach",
      artwork: "chess",
      game: "chess",
    },
  );
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
    { kind: "standard", id: "browser", title: "Browser", artwork: "browser", to: "/browser" },
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
  const standardRoutes = new Set<string>(
    tiles.filter((tile) => tile.kind === "standard").map((tile) => tile.to),
  );
  for (const plugin of MARKETPLACE_CATALOG) {
    if (!pluginState.installedPluginIds.includes(plugin.id)) continue;
    if (!pluginState.enabledPluginIds.includes(plugin.id)) continue;
    if (plugin.action.type === "navigate" && standardRoutes.has(plugin.action.to)) continue;
    if (
      plugin.action.type === "open-game" &&
      (plugin.action.gameId === "grid-defense" || plugin.action.gameId === "kupferkern")
    ) {
      continue;
    }
    tiles.push({
      kind: "plugin",
      id: `plugin:${plugin.id}`,
      title: plugin.name,
      icon: plugin.icon,
      action: plugin.action,
    });
  }
  return tiles;
}

const HOME_APP_GROUPS = Object.freeze([
  { id: "intelligence", label: "Alo Intelligence" },
  { id: "sport", label: "Fitness & Sport" },
  { id: "communication", label: "Kommunikation & Community" },
  { id: "tools", label: "Werkzeuge & System" },
  { id: "entertainment", label: "Unterhaltung & Erweiterungen" },
  { id: "own", label: "Meine Apps" },
] as const);

type HomeAppGroupId = (typeof HOME_APP_GROUPS)[number]["id"];

const HOME_ROUTE_GROUPS: Record<string, HomeAppGroupId> = {
  "/ai": "intelligence",
  "/chat": "intelligence",
  "/exercises": "sport",
  "/sports": "sport",
  "/football": "sport",
  "/training": "sport",
  "/calisthenics": "sport",
  "/coach": "sport",
  "/profile": "tools",
  "/admin": "tools",
  "/browser": "tools",
  "/tools": "tools",
  "/areas": "tools",
  "/marketplace": "tools",
};

function homeTileGroupId(tile: HomeHubTile): HomeAppGroupId {
  if (tile.kind === "game") return "entertainment";
  if (tile.kind === "marketplace") return "own";
  if (tile.kind === "plugin") {
    if (tile.action.type === "open-game") return "entertainment";
    if (tile.action.type === "open-tool") return "tools";
    return HOME_ROUTE_GROUPS[tile.action.to] ?? "own";
  }
  return HOME_ROUTE_GROUPS[tile.to] ?? "own";
}

function HomeAppHub({
  displayName,
  avatarUrl,
}: {
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
}) {
  const { user } = Route.useRouteContext();
  useHomeAppAccountSync(user.id);
  const activeUserIdRef = useRef<string | null>(user.id);
  activeUserIdRef.current = user.id;
  useEffect(() => {
    activeUserIdRef.current = user.id;
    return () => {
      activeUserIdRef.current = null;
    };
  }, [user.id]);
  const [canSeeAdmin, setCanSeeAdmin] = useState(false);
  const [installState, setInstallState] = useState<MarketplacePublishedInstallState>(
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  );
  const [pluginState, setPluginState] = useState<MarketplaceInstallState>(
    EMPTY_MARKETPLACE_INSTALL_STATE,
  );
  const [marketplaceStorageError, setMarketplaceStorageError] = useState("");
  const [settings, setSettings] = useState<HomeAppHubSettings>(EMPTY_HOME_APP_HUB_SETTINGS);
  const [settingsError, setSettingsError] = useState("");
  const [recentAppIds, setRecentAppIds] = useState<string[]>([]);
  const { healthToday, streak, weeklyWorkouts, dailyReps, dailyGoal } = useHomeDayData(user.id);
  const nexusUnread = useNexusUnread(user.id);
  const postfach = usePostfach();
  const [aiStatus, setAiStatus] = useState<HomeAiStatus | null>(null);
  const [isEditingHub, setIsEditingHub] = useState(false);
  const [activeHomePage, setActiveHomePage] = useState(0);
  const homeTouchStartXRef = useRef<number | null>(null);
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
    const load = () => {
      try {
        setSettings(loadHomeAppHubSettings(window.localStorage, user.id));
        setSettingsError("");
      } catch {
        setSettings(EMPTY_HOME_APP_HUB_SETTINGS);
        setSettingsError("Home-Einstellungen sind in diesem Browser nicht verfügbar.");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === homeAppHubSettingsStorageKey(user.id)) load();
    };
    const onApplied = (event: Event) => {
      if ((event as CustomEvent<{ userId?: string }>).detail?.userId === user.id) load();
    };
    load();
    window.addEventListener("storage", onStorage);
    window.addEventListener(HOME_APP_SYNC_APPLIED, onApplied);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HOME_APP_SYNC_APPLIED, onApplied);
    };
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
    const onApplied = (event: Event) => {
      if ((event as CustomEvent<{ userId?: string }>).detail?.userId === user.id) load();
    };
    load();
    window.addEventListener("storage", onStorage);
    window.addEventListener(HOME_APP_SYNC_APPLIED, onApplied);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HOME_APP_SYNC_APPLIED, onApplied);
    };
  }, [canSeeAdmin, user.id]);

  useEffect(() => {
    const load = () => {
      try {
        setPluginState(loadMarketplaceInstallState(window.localStorage, user.id));
      } catch {
        setPluginState(EMPTY_MARKETPLACE_INSTALL_STATE);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === marketplaceInstallStorageKey(user.id)) load();
    };
    load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user.id]);

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

  useEffect(() => {
    setRecentAppIds(loadRecentHomeAppIds(window.localStorage, user.id));
  }, [user.id]);

  useEffect(() => {
    setAiStatus(aiStatusFromProviders(loadProviders(user.id)));
  }, [user.id]);

  const rememberAppOpen = (appId: string) => {
    try {
      setRecentAppIds(rememberHomeAppOpen(window.localStorage, user.id, appId));
    } catch {
      setRecentAppIds([]);
    }
  };

  const renderHomeWidget = (
    widgetId: HomeWidgetId,
  ): {
    title: string;
    body: string;
    link: { to: "/chat" | "/marketplace" | "/postfach"; label: string } | null;
  } => {
    switch (widgetId) {
      case "health-today": {
        const parts = healthToday ? formatHealthTodayParts(healthToday) : [];
        return {
          title: "Health heute",
          body: parts.length > 0 ? parts.join(" · ") : "Keine Messwerte für heute.",
          link: null,
        };
      }
      case "fitness-week": {
        const workoutLine =
          weeklyWorkouts !== null ? formatWeeklyWorkoutLine(weeklyWorkouts) : null;
        const streakLine = formatStreakLine(streak);
        return {
          title: "Training & Streak",
          body: [
            workoutLine ?? "Keine Trainingsdaten diese Woche.",
            streakLine ?? "Noch kein Streak.",
          ].join(" · "),
          link: null,
        };
      }
      case "daily-goal": {
        if (dailyGoal <= 0) {
          return { title: "Tagesziel", body: "Kein Tagesziel gesetzt.", link: null };
        }
        if (dailyReps === null) {
          return { title: "Tagesziel", body: "Unbekannter Stand.", link: null };
        }
        return {
          title: "Tagesziel",
          body:
            dailyReps >= dailyGoal
              ? `Ziel erreicht: ${dailyReps} / ${dailyGoal} Wiederholungen`
              : `${dailyReps} / ${dailyGoal} Wiederholungen heute`,
          link: null,
        };
      }
      case "postfach-unread":
        return {
          title: "Postfach ungelesen",
          body: !postfach.available
            ? "Postfach nicht verfügbar."
            : postfach.unreadCount === 0
              ? "Alles gelesen."
              : `${postfach.unreadCount} ungelesene Nachrichten`,
          link:
            postfach.available && postfach.unreadCount > 0
              ? { to: "/postfach", label: "Postfach öffnen" }
              : null,
        };
      case "nexus-unread":
        return {
          title: "Nexus ungelesen",
          body:
            nexusUnread === null
              ? "Unbekannter Stand."
              : nexusUnread === 0
                ? "Alles gelesen."
                : `${nexusUnread} ungelesene Nachrichten`,
          link:
            nexusUnread !== null && nexusUnread > 0 ? { to: "/chat", label: "Nexus öffnen" } : null,
        };
      case "ai-status":
        return {
          title: "KI-Status",
          body: aiStatus ? `${aiStatus.provider} · ${aiStatus.model}` : "Kein KI-Anbieter aktiv.",
          link: null,
        };
      case "installed-apps": {
        const installs = installState.installs;
        const names = installs
          .map((install) => install.manifestName ?? `Alo-App ${install.appId.slice(0, 8)}`)
          .slice(0, 4);
        return {
          title: "Meine Apps",
          body:
            installs.length === 0
              ? "Noch keine Marketplace-Apps installiert."
              : `${names.join(" · ")}${installs.length > names.length ? ` · +${installs.length - names.length} weitere` : ""}`,
          link: { to: "/marketplace", label: "Marketplace öffnen" },
        };
      }
    }
  };

  const requestChatSummary = () => {
    const prompt = SUPER_TOOLS.find((tool) => tool.id === "chat_summary")?.prompt;
    if (!prompt) return;
    try {
      const sessionId = currentMiraSession();
      handoffToMira({
        userId: user.id,
        sessionId,
        expectedDraft: readMiraDraft(sessionId),
        text: prompt,
        choice: "append",
      });
      window.sessionStorage.setItem("alo-mira-autosend", "1");
      navigate({ to: "/ai" });
    } catch {
      setHomeStatus("Zusammenfassung konnte nicht an Mira übergeben werden.");
    }
  };

  const tiles = buildHomeHubTiles(canSeeAdmin, installState.installs, pluginState);
  const visibleAppIds = tiles.map((tile) => tile.id);
  const orderedTiles = orderHomeAppIds(visibleAppIds, settings.order).flatMap((appId) => {
    const tile = tiles.find((candidate) => candidate.id === appId);
    return tile ? [tile] : [];
  });
  const homePageSize = 12;
  const homePageCount = Math.max(1, Math.ceil(orderedTiles.length / homePageSize));
  const currentHomePage = Math.min(activeHomePage, homePageCount - 1);
  const currentHomePageTiles = orderedTiles.slice(
    currentHomePage * homePageSize,
    (currentHomePage + 1) * homePageSize,
  );
  const homeDockTiles = ["mira", "nexus", "health", "training"]
    .map((id) => orderedTiles.find((tile) => tile.id === id))
    .filter((tile): tile is HomeHubTile => Boolean(tile));
  const favoriteTiles = orderedTiles.filter((tile) => settings.favorites.includes(tile.id));
  const recentTiles = recentAppIds
    .flatMap((appId) => {
      const tile = orderedTiles.find((candidate) => candidate.id === appId);
      return tile && !settings.favorites.includes(tile.id) ? [tile] : [];
    })
    .slice(0, 4);
  const homeSections = HOME_APP_GROUPS.map(({ id, label }) => ({
    id,
    label,
    tiles: orderedTiles.filter(
      (tile) => !settings.favorites.includes(tile.id) && homeTileGroupId(tile) === id,
    ),
  })).filter((section) => section.tiles.length > 0);
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
      if (activeUserIdRef.current !== user.id) return false;
      const merged = mergeHomeAppLocalEdit(
        settings,
        next,
        loadHomeAppHubSettings(window.localStorage, user.id),
      );
      saveHomeAppHubSettings(window.localStorage, user.id, merged);
      setSettings(merged);
      setSettingsError("");
      setHomeStatus(status);
      if (JSON.stringify(settings.nameOverrides) !== JSON.stringify(next.nameOverrides))
        requestHomeAppAccountSync(user.id);
      return true;
    } catch {
      setSettingsError("Die Änderung konnte nicht lokal gespeichert werden.");
      return false;
    }
  };

  const persistInstallState = async (nextInput: unknown, status: string) => {
    try {
      const access = await getAdminAreaAccess();
      if (activeUserIdRef.current !== user.id) return false;
      if (!isMarketplaceAdminAccessGranted(access)) {
        setHomeStatus("Admin-Zugriff ist nicht mehr bestätigt. Die Änderung wurde blockiert.");
        return false;
      }
      const next = mergeMarketplaceLocalEdit(
        installState,
        parseMarketplacePublishedInstallState(nextInput),
        loadMarketplacePublishedInstallState(window.localStorage, user.id),
      );
      saveMarketplacePublishedInstallState(window.localStorage, user.id, next);
      setInstallState(next);
      setMarketplaceStorageError("");
      setHomeStatus(status);
      requestHomeAppAccountSync(user.id);
      return true;
    } catch {
      if (activeUserIdRef.current === user.id)
        setMarketplaceStorageError(
          "Die App-Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.",
        );
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
      if (persistSettings(next, "App-Name gespeichert. Kontoabgleich folgt.")) {
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

  const uninstallPluginFromHome = (tile: Extract<HomeHubTile, { kind: "plugin" }>) => {
    const pluginId = tile.id.slice("plugin:".length);
    const status = `„${uninstallTargetTitle}“ wurde von diesem Gerät entfernt. Installieren kannst du sie wieder im Marketplace.`;
    try {
      const next = removeMarketplacePlugin(pluginState, pluginId);
      saveMarketplaceInstallState(window.localStorage, user.id, next);
      setPluginState(next);
      try {
        const nextSettings = mergeHomeAppLocalEdit(
          settings,
          forgetHomeAppPersonalization(settings, tile.id),
          loadHomeAppHubSettings(window.localStorage, user.id),
        );
        saveHomeAppHubSettings(window.localStorage, user.id, nextSettings);
        setSettings(nextSettings);
        setSettingsError("");
      } catch {
        setSettingsError(
          "Die Installation wurde entfernt; der gespeicherte App-Name konnte nicht bereinigt werden.",
        );
      }
      setHomeStatus(status);
    } catch {
      setHomeStatus("Die App konnte nicht lokal entfernt werden.");
    }
    setUninstallTargetAppId(null);
  };

  const uninstallMarketplaceAppFromHome = async () => {
    if (!uninstallTargetTile || isUninstallingApp) {
      return;
    }
    if (uninstallTargetTile.kind === "plugin") {
      uninstallPluginFromHome(uninstallTargetTile);
      return;
    }
    if (uninstallTargetTile.kind !== "marketplace") return;
    const { appId } = uninstallTargetTile.install;
    const status = `„${uninstallTargetTitle}“ wurde entfernt. Eigene Apps werden im Konto abgeglichen; der Marketplace-Eintrag bleibt erhalten.`;
    setIsUninstallingApp(true);
    try {
      const removed = await persistInstallState(
        removeMarketplacePublishedApp(installState, appId),
        status,
      );
      if (!removed) return;
      try {
        const nextSettings = mergeHomeAppLocalEdit(
          settings,
          forgetHomeAppPersonalization(settings, uninstallTargetTile.id),
          loadHomeAppHubSettings(window.localStorage, user.id),
        );
        saveHomeAppHubSettings(window.localStorage, user.id, nextSettings);
        setSettings(nextSettings);
        setSettingsError("");
        requestHomeAppAccountSync(user.id);
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

  const navigate = useNavigate();
  const openPluginAction = (action: MarketplaceHostAction) => {
    if (action.type === "navigate") {
      void navigate({ to: action.to as never });
    } else if (action.type === "open-game") {
      void navigate({ to: "/games", search: { game: action.gameId } });
    } else {
      window.dispatchEvent(new CustomEvent("alo-open", { detail: action.toolId }));
    }
  };

  const renderTile = (tile: HomeHubTile, title: string, badge: number | null = null) => {
    const tileSize: HomeAppTileSize = settings.tileSizes[tile.id] ?? "small";
    const large = tileSize === "large";
    if (tile.kind === "plugin") {
      const contents = (
        <>
          <span
            className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-[20px] border border-white/10 bg-card shadow-md ${large ? "max-w-[160px]" : "max-w-[96px]"}`}
          >
            <MarketplaceIcon icon={tile.icon} className="h-8 w-8 text-primary" />
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
          onClick={() => openPluginAction(tile.action)}
        >
          {contents}
        </button>
      );
    }
    if (tile.kind === "marketplace") {
      const contents = (
        <>
          <span
            className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-[20px] border border-white/10 bg-card shadow-md ${large ? "max-w-[160px]" : "max-w-[96px]"}`}
          >
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
          <HubAppIconContents title={title} artwork={tile.artwork} large={large} />
        </div>
      );
    }
    if (tile.kind === "game") {
      return <HubGameAppIcon game={tile.game} title={title} artwork={tile.artwork} large={large} />;
    }
    if (tile.to === "/areas") {
      return (
        <Link
          to="/areas"
          className={`alo-tablet-home-app-action ${HUB_APP_ICON_CLASS_NAME}`}
          aria-label={`Weitere Bereiche öffnen (${HOME_OTHER_AREAS.length})`}
        >
          <HubAppIconContents title={title} artwork={tile.artwork} large={large} />
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
          <HubAppIconContents title={title} artwork={tile.artwork} large={large} />
        </Link>
      );
    }
    return (
      <HubAppIcon to={tile.to} title={title} artwork={tile.artwork} badge={badge} large={large} />
    );
  };

  const renderHomeGroup = (groupId: string, label: string, groupTiles: HomeHubTile[]) => {
    const collapsed = groupId === "launcher" ? false : settings.collapsedGroups.includes(groupId);
    return (
      <section
        key={groupId}
        aria-label={groupId === "launcher" ? "Alo-Startseite" : `Alo-Apps: ${label}`}
      >
        {groupId !== "launcher" && (
          <button
            type="button"
            aria-expanded={!collapsed}
            data-home-group-toggle={groupId}
            onClick={() => {
              try {
                persistSettings(
                  toggleHomeAppGroupCollapsed(settings, groupId),
                  collapsed ? "Home-Gruppe eingeblendet." : "Home-Gruppe ausgeblendet.",
                );
              } catch {
                setSettingsError("Diese Gruppe konnte nicht umgeschaltet werden.");
              }
            }}
            className="mb-3 flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            />
            {label}
            <span className="ml-auto text-[10px] font-medium normal-case tracking-normal">
              {groupTiles.length}
            </span>
          </button>
        )}
        {!collapsed && (
          <div className="alo-tablet-home-apps grid w-full grid-flow-row-dense grid-cols-4 gap-x-3 gap-y-6">
            {groupTiles.map((tile) => {
              const title = settings.nameOverrides[tile.id] ?? tile.title;
              const badge =
                tile.id === "nexus" && nexusUnread !== null && nexusUnread > 0 ? nexusUnread : null;
              const tileSize: HomeAppTileSize = settings.tileSizes[tile.id] ?? "small";
              return (
                <div
                  key={tile.id}
                  data-home-app-id={tile.id}
                  data-home-tile-size={tileSize}
                  className={`relative min-w-0 select-none rounded-xl transition ${HOME_APP_TILE_SIZE_CLASS_NAMES[tileSize]} ${tileSize === "large" ? "flex flex-col items-center justify-center" : ""}`}
                  onPointerDown={(event) => startHomeLongPress(event, tile.id)}
                  onPointerUp={() => cancelHomeLongPress()}
                  onPointerCancel={() => cancelHomeLongPress()}
                  onClickCapture={(event) => suppressLongPressClick(event, tile.id)}
                  onClick={() => rememberAppOpen(tile.id)}
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
                >
                  {renderTile(tile, title, badge)}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
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
                  <img
                    src={avatarUrl}
                    alt=""
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
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
          {isEditingHub ? (
            <AloErrorBoundary section="Apps">
              <nav
                className="alo-tablet-home-apps grid w-full max-w-[520px] grid-flow-row-dense grid-cols-4 gap-x-3 gap-y-6"
                aria-label="Alo-Apps"
                onPointerMoveCapture={moveHomeTileDrag}
              >
                {orderedTiles.map((tile) => {
                  const title = settings.nameOverrides[tile.id] ?? tile.title;
                  const editTileSize: HomeAppTileSize = settings.tileSizes[tile.id] ?? "small";
                  return (
                    <div
                      key={tile.id}
                      data-home-app-id={tile.id}
                      data-home-tile-size={editTileSize}
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
                      className={`relative min-w-0 select-none rounded-xl transition ${HOME_APP_TILE_SIZE_CLASS_NAMES[editTileSize]} ${editTileSize === "large" ? "flex flex-col items-center justify-center" : ""} ${isEditingHub ? "touch-none cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing" : ""} ${draggingAppId && dropTargetAppId === tile.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
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
            </AloErrorBoundary>
          ) : (
            <div className="flex w-full max-w-[520px] flex-col gap-7">
              <AloErrorBoundary section="Dein Tag">
                <section className="alo-launcher-greeting" aria-label="Dein Tag">
                  <p>{homeDayGreeting(new Date().getHours())}!</p>
                  <span>
                    {new Date().toLocaleDateString("de-DE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  {(() => {
                    const streakLine = formatStreakLine(streak);
                    const workoutLine =
                      weeklyWorkouts !== null ? formatWeeklyWorkoutLine(weeklyWorkouts) : null;
                    const healthParts =
                      healthToday && hasMeasuredHealthToday(healthToday)
                        ? formatHealthTodayParts(healthToday)
                        : [];
                    const dailyGoalLine = formatDailyGoalLine(dailyReps, dailyGoal);
                    const postfachLine = formatPostfachContextLine(
                      postfach.unreadCount,
                      postfach.actionableCount,
                      postfach.available,
                    );
                    const offerChatSummary = shouldOfferChatSummary(nexusUnread);
                    if (
                      healthParts.length === 0 &&
                      !streakLine &&
                      !workoutLine &&
                      !dailyGoalLine &&
                      !postfachLine &&
                      !aiStatus &&
                      !offerChatSummary
                    )
                      return null;
                    return (
                      <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                        {healthParts.length > 0 && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="font-semibold text-foreground">Health heute:</dt>
                            <dd>{healthParts.join(" · ")}</dd>
                          </div>
                        )}
                        {workoutLine && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="font-semibold text-foreground">Training:</dt>
                            <dd>{workoutLine}</dd>
                          </div>
                        )}
                        {streakLine && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="font-semibold text-foreground">Streak:</dt>
                            <dd>{streakLine}</dd>
                          </div>
                        )}
                        {offerChatSummary && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <dt className="font-semibold text-foreground">Nexus Chat:</dt>
                            <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>{nexusUnread} ungelesene Nachrichten</span>
                              <button
                                type="button"
                                onClick={requestChatSummary}
                                className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-primary hover:border-primary/50"
                              >
                                Zusammenfassung bei Mira anfragen
                              </button>
                            </dd>
                          </div>
                        )}
                        {dailyGoalLine && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="font-semibold text-foreground">Tagesziel:</dt>
                            <dd>{dailyGoalLine}</dd>
                          </div>
                        )}
                        {postfachLine && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="font-semibold text-foreground">Postfach:</dt>
                            <dd>{postfachLine}</dd>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="font-semibold text-foreground">KI:</dt>
                          <dd>
                            {aiStatus
                              ? `${aiStatus.provider} · ${aiStatus.model}`
                              : "Kein KI-Anbieter aktiv"}
                          </dd>
                        </div>
                      </dl>
                    );
                  })()}
                </section>
              </AloErrorBoundary>
              {settings.widgetOrder.length > 0 && (
                <AloErrorBoundary section="Widgets">
                  <section
                    aria-label="Widgets"
                    className="grid grid-flow-row-dense grid-cols-2 gap-3"
                  >
                    {settings.widgetOrder.map((widgetId) => {
                      const widget = renderHomeWidget(widgetId as HomeWidgetId);
                      const widgetSize: HomeWidgetSize = settings.widgetSizes[widgetId] ?? "small";
                      return (
                        <div
                          key={widgetId}
                          data-home-widget-id={widgetId}
                          className={`rounded-2xl border border-border bg-card/60 p-4 backdrop-blur ${HOME_WIDGET_SIZE_CLASS_NAMES[widgetSize]}`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {widget.title}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-foreground">
                            {widget.body}
                          </p>
                          {widget.link && (
                            <Link
                              to={widget.link.to}
                              className="mt-2 inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline"
                            >
                              {widget.link.label}
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </section>
                </AloErrorBoundary>
              )}
              <AloErrorBoundary section="Apps">
                <div
                  className="alo-launcher-page"
                  aria-label={`Startseite ${currentHomePage + 1} von ${homePageCount}`}
                  onTouchStart={(event) => {
                    homeTouchStartXRef.current = event.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(event) => {
                    const startX = homeTouchStartXRef.current;
                    const endX = event.changedTouches[0]?.clientX;
                    homeTouchStartXRef.current = null;
                    if (startX === null || endX === undefined || Math.abs(endX - startX) < 56) {
                      return;
                    }
                    setActiveHomePage((page) =>
                      Math.max(0, Math.min(homePageCount - 1, page + (endX < startX ? 1 : -1))),
                    );
                  }}
                >
                  {renderHomeGroup("launcher", "Apps", currentHomePageTiles)}
                  {homePageCount > 1 && (
                    <nav
                      className="alo-launcher-page-indicators"
                      aria-label="Startseiten auswählen"
                    >
                      {Array.from({ length: homePageCount }, (_, page) => (
                        <button
                          key={page}
                          type="button"
                          aria-label={`Startseite ${page + 1}`}
                          aria-current={currentHomePage === page ? "page" : undefined}
                          onClick={() => setActiveHomePage(page)}
                          className="alo-launcher-page-dot"
                        />
                      ))}
                    </nav>
                  )}
                </div>
                <nav className="alo-launcher-dock" aria-label="Favoritenleiste">
                  {homeDockTiles.map((tile) => {
                    const title = settings.nameOverrides[tile.id] ?? tile.title;
                    const badge =
                      tile.id === "nexus" && nexusUnread !== null && nexusUnread > 0
                        ? nexusUnread
                        : null;
                    return (
                      <div key={tile.id} className="alo-launcher-dock-item">
                        {renderTile(tile, title, badge)}
                      </div>
                    );
                  })}
                </nav>
              </AloErrorBoundary>
            </div>
          )}

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

              <section
                className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4"
                aria-label="Widgets anpassen"
              >
                <div>
                  <h2 className="text-sm font-bold">Widgets</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Widgets zeigen ausschließlich echte Daten aus deinen Alo-Apps und werden lokal
                    auf diesem Gerät gespeichert.
                  </p>
                </div>
                <div className="grid gap-2">
                  {HOME_WIDGET_CATALOG.map((widget) => {
                    const added = settings.widgetOrder.includes(widget.id);
                    const widgetIndex = settings.widgetOrder.indexOf(widget.id);
                    const widgetSize: HomeWidgetSize = settings.widgetSizes[widget.id] ?? "small";
                    const nextSize: HomeWidgetSize = widgetSize === "wide" ? "small" : "wide";
                    return (
                      <div
                        key={widget.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{widget.label}</p>
                          <p className="text-xs text-muted-foreground">{widget.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {added && (
                            <>
                              <button
                                type="button"
                                aria-label={`${widget.label} nach vorne verschieben`}
                                disabled={widgetIndex <= 0}
                                onClick={() => {
                                  try {
                                    persistSettings(
                                      moveHomeWidget(settings, widget.id, -1),
                                      "Widget-Reihenfolge lokal gespeichert.",
                                    );
                                  } catch {
                                    setSettingsError("Widget konnte nicht verschoben werden.");
                                  }
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border disabled:opacity-40"
                              >
                                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`${widget.label} nach hinten verschieben`}
                                disabled={
                                  widgetIndex < 0 || widgetIndex >= settings.widgetOrder.length - 1
                                }
                                onClick={() => {
                                  try {
                                    persistSettings(
                                      moveHomeWidget(settings, widget.id, 1),
                                      "Widget-Reihenfolge lokal gespeichert.",
                                    );
                                  } catch {
                                    setSettingsError("Widget konnte nicht verschoben werden.");
                                  }
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border disabled:opacity-40"
                              >
                                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`${widget.label} ${HOME_WIDGET_SIZE_LABELS[nextSize]} machen`}
                                onClick={() => {
                                  try {
                                    persistSettings(
                                      setHomeWidgetSize(settings, widget.id, nextSize),
                                      `Widget-Größe von „${widget.label}“ auf „${HOME_WIDGET_SIZE_LABELS[nextSize]}“ gesetzt.`,
                                    );
                                  } catch {
                                    setSettingsError(
                                      "Widget-Größe konnte nicht gespeichert werden.",
                                    );
                                  }
                                }}
                                className="min-h-10 rounded-xl border border-border px-3 text-xs font-semibold"
                              >
                                {HOME_WIDGET_SIZE_LABELS[nextSize]}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                persistSettings(
                                  added
                                    ? removeHomeWidget(settings, widget.id)
                                    : addHomeWidget(settings, widget.id),
                                  added
                                    ? `Widget „${widget.label}“ entfernt.`
                                    : `Widget „${widget.label}“ hinzugefügt.`,
                                );
                              } catch {
                                setSettingsError("Widget konnte nicht geändert werden.");
                              }
                            }}
                            className={`min-h-10 rounded-xl border px-3 text-xs font-semibold ${added ? "border-destructive/40 text-destructive" : "border-primary/50 text-primary"}`}
                          >
                            {added ? "Entfernen" : "Hinzufügen"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  ? "Name und Installation eigener veröffentlichter Apps werden mit deinem Konto abgeglichen. Fremde Marketplace-Apps bleiben lokal. Aktionsfreigaben gelten nur auf diesem Gerät."
                  : activeActionTile.kind === "plugin"
                    ? "Diese Marketplace-App ist auf diesem Gerät installiert. Deinstallieren entfernt sie nur hier; im Marketplace kannst du sie wieder installieren."
                    : "Der Name dieser Alo-App wird mit deinem Konto abgeglichen. Reihenfolge und Hintergrund bleiben auf diesem Gerät."}
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
                <div
                  role="group"
                  aria-label={`${activeActionTitle} Kachelgröße wählen`}
                  className="grid grid-cols-3 gap-2"
                >
                  {HOME_APP_TILE_SIZES.map((size) => {
                    const current = (settings.tileSizes[activeActionTile.id] ?? "small") === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={current}
                        aria-label={`${activeActionTitle} Kachelgröße ${HOME_APP_TILE_SIZE_LABELS[size]}`}
                        onClick={() => {
                          try {
                            persistSettings(
                              setHomeAppTileSize(settings, activeActionTile.id, size),
                              `Kachelgröße von „${activeActionTitle}“ auf „${HOME_APP_TILE_SIZE_LABELS[size]}“ gesetzt.`,
                            );
                          } catch {
                            setSettingsError("Kachelgröße konnte nicht gespeichert werden.");
                          }
                          setActiveAppMenuId(null);
                        }}
                        className={`min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${current ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                      >
                        {HOME_APP_TILE_SIZE_LABELS[size]}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const wasFavorite = settings.favorites.includes(activeActionTile.id);
                    try {
                      persistSettings(
                        toggleHomeAppFavorite(settings, activeActionTile.id),
                        wasFavorite
                          ? `„${activeActionTitle}“ wurde aus den Favoriten entfernt.`
                          : `„${activeActionTitle}“ wurde zu den Favoriten hinzugefügt.`,
                      );
                    } catch {
                      setSettingsError("Favorit konnte nicht gespeichert werden.");
                    }
                    setActiveAppMenuId(null);
                  }}
                  className="min-h-12 rounded-xl border border-border px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {settings.favorites.includes(activeActionTile.id)
                    ? "Aus Favoriten entfernen"
                    : "Zu Favoriten hinzufügen"}
                </button>
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
                {(activeActionTile.kind === "marketplace" ||
                  activeActionTile.kind === "plugin") && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAppMenuId(null);
                      setUninstallTargetAppId(activeActionTile.id);
                    }}
                    className="min-h-12 rounded-xl border border-destructive/40 px-4 text-left text-sm font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Deinstallieren
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
            <AlertDialogTitle>„{uninstallTargetTitle}“ deinstallieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Bei eigenen veröffentlichten Apps wird das Entfernen mit allen angemeldeten Geräten
              abgeglichen; fremde Apps werden nur hier entfernt. Der Marketplace-Eintrag bleibt
              unverändert. Aktionsfreigaben müssen bei einer erneuten Installation auf jedem Gerät
              neu bestätigt werden.
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
              {isUninstallingApp ? "Entferne …" : "Deinstallieren"}
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
  | "neonStarfighter"
  | "chess"
  | "more"
  | "training"
  | "tools"
  | "marketplace"
  | "browser";

const HUB_APP_ICON_CLASS_NAME =
  "group relative flex w-full min-w-0 flex-col items-center gap-2 rounded-xl text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function HubAppIcon({
  to,
  title,
  artwork,
  badge = null,
  large = false,
}: {
  to:
    | "/ai"
    | "/chat"
    | "/exercises"
    | "/profile"
    | "/admin"
    | "/training"
    | "/marketplace"
    | "/browser";
  title: string;
  artwork: Exclude<HubArtworkKind, "gridDefense" | "kupferkern">;
  badge?: number | null;
  large?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={badge !== null ? `${title} öffnen, ${badge} ungelesen` : `${title} öffnen`}
      className={`${HUB_APP_ICON_CLASS_NAME} ${large ? "justify-center" : ""}`}
    >
      <HubAppIconContents title={title} artwork={artwork} badge={badge} large={large} />
    </Link>
  );
}

function HubGameAppIcon({
  game,
  title,
  artwork,
  large = false,
}: {
  game: PublicGameId;
  title: string;
  artwork: "gridDefense" | "kupferkern" | "neonStarfighter" | "chess";
  large?: boolean;
}) {
  return (
    <Link
      to="/games"
      search={{ game }}
      aria-label={`${title} öffnen`}
      className={`${HUB_APP_ICON_CLASS_NAME} ${large ? "justify-center" : ""}`}
    >
      <HubAppIconContents title={title} artwork={artwork} large={large} />
    </Link>
  );
}

function HubAppIconContents({
  title,
  artwork,
  badge = null,
  large = false,
}: {
  title: string;
  artwork: HubArtworkKind;
  badge?: number | null;
  large?: boolean;
}) {
  return (
    <>
      <span
        className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-[20px] border border-white/10 bg-card shadow-md transition group-hover:scale-105 group-hover:shadow-lg ${large ? "max-w-[160px]" : "max-w-[96px]"}`}
      >
        <HubArtwork kind={artwork} />
      </span>
      {badge !== null && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
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
    neonStarfighter: { bg: "#07152c", accent: "#67e8f9", glow: "#2563eb" },
    chess: { bg: "#18251e", accent: "#d9f99d", glow: "#65a30d" },
    more: { bg: "#172735", accent: "#67e8f9", glow: "#0ea5e9" },
    training: { bg: "#30291d", accent: "#fcd34d", glow: "#f59e0b" },
    tools: { bg: "#25233a", accent: "#c4b5fd", glow: "#8b5cf6" },
    marketplace: { bg: "#32261c", accent: "#fdba74", glow: "#ea580c" },
    browser: { bg: "#1c2a38", accent: "#93c5fd", glow: "#3b82f6" },
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
      {kind === "neonStarfighter" && (
        <>
          <path d="m140 27 17 43-17 35-17-35 17-43Z" fill={palette.accent} />
          <path d="m140 27 7 44-7 14-7-14 7-44Z" fill="#fff" opacity=".9" />
          <path
            d="m123 70-29 16 18 3 11-19Zm17 0 29 16-18 3-11-19Z"
            fill={palette.glow}
            stroke={palette.accent}
            strokeWidth="3"
          />
          <path
            d="M134 105 140 120 146 105"
            stroke="#fbbf24"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="91" cy="35" r="3" fill="#fff" />
          <circle cx="195" cy="95" r="4" fill="#fff" />
        </>
      )}
      {kind === "chess" && (
        <>
          <path
            d="M140 24c-9 0-15 7-15 15 0 6 3 10 8 13l-5 12h24l-5-12c5-3 8-7 8-13 0-8-6-15-15-15Z"
            fill={palette.accent}
          />
          <path d="M122 67h36l8 14-8 8h-36l-8-8 8-14Z" fill={palette.accent} />
          <path d="M117 94h46v10h-46z" fill={palette.glow} />
          <path d="M109 108h62v8h-62z" fill={palette.accent} />
          <circle cx="140" cy="47" r="4" fill="#fff" />
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
      {kind === "browser" && (
        <>
          <circle cx="140" cy="66" r="43" fill={palette.glow} opacity=".24" />
          <circle cx="140" cy="66" r="30" fill="none" stroke={palette.accent} strokeWidth="5" />
          <ellipse
            cx="140"
            cy="66"
            rx="13"
            ry="30"
            fill="none"
            stroke={palette.accent}
            strokeWidth="4"
            opacity=".8"
          />
          <path
            d="M112 56h56M112 76h56"
            fill="none"
            stroke={palette.accent}
            strokeWidth="4"
            opacity=".8"
          />
        </>
      )}
      <path d="M18 18h22" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MiraOverlayLauncher() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
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
  const autoHandoffRef = useRef(false);
  const transcriptRef = useRef("");
  const voiceErrorRef = useRef<string | null>(null);
  const directHandoffRef = useRef<(text: string) => void>(() => {});

  const applyVoiceError = (value: string | null) => {
    voiceErrorRef.current = value;
    setVoiceError(value);
  };
  const applyTranscript = (value: string) => {
    transcriptRef.current = value;
    setTranscript(value);
  };

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
      applyVoiceError("Spracherkennung wird in diesem Browser nicht unterstützt.");
      return;
    }

    applyVoiceError(null);
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const recognized = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (recognized) {
        const previous = transcriptRef.current;
        applyTranscript(previous ? `${previous} ${recognized}` : recognized);
      }
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
      applyVoiceError(message);
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
      applyVoiceError(
        "Das Mikrofon konnte nicht gestartet werden. Prüfe die Berechtigung und versuche es erneut.",
      );
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      stopListening();
      inlineDictationRef.current?.cancel();
      setInterimTranscript("");
    } else applyVoiceError(null);
    setOpen(nextOpen);
  };

  const continueToMira = () => {
    if (listening) {
      stopListening();
      inlineDictationRef.current?.stop();
      applyVoiceError(
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

  directHandoffRef.current = (text: string) => {
    try {
      const sessionId = currentMiraSession();
      handoffToMira({
        userId: user.id,
        sessionId,
        expectedDraft: readMiraDraft(sessionId),
        text,
        choice: "append",
      });
      window.sessionStorage.setItem("alo-mira-autosend", "1");
      setOpen(false);
      applyTranscript("");
      navigate({ to: "/ai" });
    } catch (error) {
      applyVoiceError(
        error instanceof Error
          ? error.message
          : "Übergabe an Mira fehlgeschlagen. Prüfe den Text und nutze die Übergabe-Schaltfläche.",
      );
    }
  };

  useEffect(() => {
    const recognitionFactory = createBrowserSpeechRecognitionFactory();
    const inlineDictation = new MiraInlineDictationController({
      createRecognition: () => recognitionFactory?.() ?? null,
      onTranscript: (recognized) => {
        const previous = transcriptRef.current;
        applyTranscript(previous ? `${previous} ${recognized}` : recognized);
      },
      onInterimTranscript: setInterimTranscript,
      onListeningChange: setListening,
      onError: applyVoiceError,
      onSettled: () => {
        if (!autoHandoffRef.current) return;
        autoHandoffRef.current = false;
        const text = transcriptRef.current.trim();
        if (!text) {
          if (!voiceErrorRef.current)
            applyVoiceError(
              "Es wurde keine Sprache erkannt. Tippe auf das Mikrofon oder schreibe deine Frage.",
            );
          return;
        }
        directHandoffRef.current(text);
      },
    });
    inlineDictationRef.current = inlineDictation;
    const pressAndHold = new MiraComposerPressAndHold(
      () => {
        holdTriggeredRef.current = true;
        autoHandoffRef.current = false;
        applyVoiceError(null);
        applyTranscript("");
        setInterimTranscript("");
        inlineDictation.start();
      },
      () => {
        if (!holdTriggeredRef.current) return;
        holdTriggeredRef.current = false;
        autoHandoffRef.current = true;
        inlineDictation.stop();
        setInterimTranscript("");
        setOpen(true);
        suppressNextClick();
      },
      () => {
        if (!holdTriggeredRef.current) return;
        holdTriggeredRef.current = false;
        autoHandoffRef.current = false;
        inlineDictation.cancel();
        setInterimTranscript("");
        applyVoiceError(null);
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
          Halte die Mira-Schaltfläche, um zu diktieren; loslassen beendet die Aufnahme und übergibt
          den erkannten Text direkt an Mira. Je nach Browser kann Sprache über einen Browser-Dienst
          erkannt werden.
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
                applyTranscript("");
              }}
            />
            <button
              type="button"
              className="alo-mira-home-handoff-dismiss"
              aria-label="Diktierte Frage verwerfen"
              onClick={() => {
                setHandoffRequest(null);
                applyTranscript("");
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
            title="Tippen öffnet den Diktierdialog. Halten startet die Aufnahme; loslassen übergibt die Frage direkt an Mira."
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
        onTranscriptChange={applyTranscript}
        listening={listening}
        onStartListening={startListening}
        onStopListening={stopListening}
        error={voiceError}
        onContinue={continueToMira}
        continueLabel="Frage in Mira prüfen"
        className="alo-dialog alo-mira-voice-entry-dialog !fixed !left-0 !top-0 !z-50 !m-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none"
      />
    </>
  );
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { displayName, avatarUrl } = useHomeDayData(user.id, {
    fallbackName:
      (user.user_metadata?.display_name as string | undefined) ??
      (user.is_anonymous ? "Gast" : (user.email?.split("@")[0] ?? null)),
  });
  return (
    <main
      data-alo-ui-refresh="home"
      className="alo-tablet-home-page alo-visual-refresh relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pt-6 pb-24"
    >
      <HomeAppHub key={user.id} displayName={displayName} avatarUrl={avatarUrl} />
      <MiraOverlayLauncher />
    </main>
  );
}

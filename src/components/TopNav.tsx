import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Footprints,
  HeartPulse,
  House,
  History,
  MessageCircle,
  MonitorSmartphone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  getNavigationVisible,
  getStoredNavigationLayout,
  updateNavigationForScroll,
  type NavigationLayoutId,
} from "@/lib/navigation-layout";

type ContextTab = {
  id: string;
  label: string;
  Icon: LucideIcon;
  to?: string;
  hash?: string;
  command?: string;
};
type AppTabConfig = { id: string; label: string; tabs: ContextTab[] };
const tab = (
  id: string,
  label: string,
  Icon: LucideIcon,
  destination: Pick<ContextTab, "to" | "hash" | "command">,
): ContextTab => ({ id, label, Icon, ...destination });

function getAppTabs(pathname: string): AppTabConfig | null {
  if (pathname === "/health")
    return {
      id: "health",
      label: "Alo Health",
      tabs: [
        tab("today", "Heute", HeartPulse, { hash: "health-today" }),
        tab("activity", "Aktivität", Activity, { hash: "health-activity" }),
        tab("sleep", "Schlaf", Star, { hash: "health-sleep" }),
        tab("fitness", "Fitness", BarChart3, { hash: "health-fitness" }),
        tab("sources", "Quellen", MonitorSmartphone, { hash: "health-sources" }),
        tab("entry", "Erfassen", Plus, { hash: "health-entry" }),
      ],
    };

  if (pathname === "/run")
    return {
      id: "run",
      label: "Laufen",
      tabs: [
        tab("console", "Laufkonsole", Footprints, { hash: "run-console" }),
        tab("history", "Letzte Läufe", History, { hash: "run-history" }),
      ],
    };

  if (
    ["/training", "/programs", "/exercises", "/coach", "/calisthenics"].includes(pathname) ||
    pathname.startsWith("/workout/") ||
    pathname.startsWith("/cali-workout/")
  )
    return {
      id: "training",
      label: "Training",
      tabs: [
        tab("overview", "Übersicht", Activity, { to: "/training" }),
        tab("programs", "Programme", CalendarDays, { to: "/programs" }),
        tab("exercises", "Übungen", Dumbbell, { to: "/exercises" }),
        tab("calisthenics", "Calisthenics", Footprints, { to: "/calisthenics" }),
        tab("coach", "Coach", Sparkles, { to: "/coach" }),
      ],
    };

  if (["/sports", "/football", "/clubs", "/leaderboard", "/season"].includes(pathname))
    return {
      id: "sports",
      label: "Alo Sports",
      tabs: [
        tab("live", "Spiele", Activity, { to: "/sports" }),
        tab("football", "Fußball", Trophy, { to: "/football" }),
        tab("clubs", "Teams", Users, { to: "/clubs" }),
        tab("ranking", "Rangliste", BarChart3, { to: "/leaderboard" }),
        tab("season", "Saison", CalendarDays, { to: "/season" }),
      ],
    };

  if (pathname === "/battle" || pathname === "/battle/")
    return {
      id: "battle",
      label: "Battle",
      tabs: [
        tab("duel", "Duell", Trophy, { to: "/battle" }),
        tab("league", "Liga", BarChart3, { to: "/battle-league" }),
      ],
    };

  if (pathname === "/battle-league")
    return {
      id: "battle-league",
      label: "Battle-Liga",
      tabs: [
        tab("duel", "Duell", Swords, { to: "/battle" }),
        tab("ranking", "Dein Ranking", Trophy, { hash: "battle-ranking" }),
        tab("leaderboard", "Rangliste", BarChart3, { hash: "battle-leaderboard" }),
      ],
    };

  if (pathname === "/ai")
    return {
      id: "mira",
      label: "Mira",
      tabs: [
        tab("chat", "Chat", MessageCircle, { command: "mira-view-chat" }),
        tab("new", "Neuer Chat", Sparkles, { command: "mira-new-chat" }),
        tab("history", "Verlauf", History, { command: "mira-view-history" }),
        tab("tasks", "Aufgaben", ClipboardList, { command: "mira-view-tasks" }),
        tab("devices", "Geräte", MonitorSmartphone, { to: "/mira-devices" }),
        tab("settings", "KI-Setup", Settings2, { command: "mira-open-settings" }),
      ],
    };

  if (pathname === "/mira-devices")
    return {
      id: "mira",
      label: "Mira",
      tabs: [
        tab("chat", "Chat", MessageCircle, { to: "/ai" }),
        tab("devices", "Geräte", MonitorSmartphone, { to: "/mira-devices" }),
      ],
    };

  if (pathname === "/chat")
    return {
      id: "nexus",
      label: "Nexus",
      tabs: [
        tab("chats", "Chats", MessageCircle, { command: "nexus-open-list" }),
        tab("search", "Suchen", Search, { command: "nexus-open-search" }),
        tab("room", "Neuer Raum", Users, { command: "nexus-new-room" }),
        tab("dm", "Neue DM", MessageCircle, { command: "nexus-new-dm" }),
        tab("export", "Export", ClipboardList, { command: "nexus-export-current" }),
      ],
    };

  if (pathname === "/alarm")
    return {
      id: "alarm",
      label: "Wecker",
      tabs: [
        tab("settings", "Weckzeit", AlarmClock, { hash: "alarm-settings" }),
        tab("saved", "Gespeichert", ClipboardList, { hash: "alarm-saved" }),
        tab("notice", "Hinweis", BookOpen, { hash: "alarm-note" }),
      ],
    };

  if (pathname === "/postfach")
    return {
      id: "postfach",
      label: "Postfach",
      tabs: [
        tab("open", "Offen", MessageCircle, { hash: "postfach-open" }),
        tab("history", "Verlauf", History, { hash: "postfach-history" }),
        tab("add", "Freunde", Users, { hash: "postfach-add" }),
      ],
    };

  if (pathname === "/admin")
    return {
      id: "admin",
      label: "Admin",
      tabs: [
        tab("digest", "Feature-Digest", ClipboardList, { hash: "feature-release-digest-title" }),
        tab("overview", "Übersicht", ShieldCheck, { hash: "admin-sections-title" }),
      ],
    };

  if (pathname === "/browser")
    return {
      id: "browser",
      label: "Alo Browser",
      tabs: [
        tab("back", "Zurück", ArrowLeft, { command: "browser-back" }),
        tab("forward", "Vor", ArrowRight, { command: "browser-forward" }),
        tab("new", "Neuer Tab", Plus, { command: "browser-new-tab" }),
        tab("mira", "Mira", Sparkles, { command: "browser-mira" }),
      ],
    };

  if (pathname === "/tools" || pathname === "/areas" || pathname === "/marketplace")
    return {
      id: "tools",
      label: pathname === "/marketplace" ? "Marketplace" : "Werkzeuge",
      tabs: [
        tab("tools", "Werkzeuge", Wrench, { to: "/tools" }),
        tab("areas", "Bereiche", Activity, { to: "/areas" }),
        tab("marketplace", "Marketplace", Star, { to: "/marketplace" }),
      ],
    };

  const settingsIds = [
    ["profile", "Profil", Users],
    ["apps", "Apps", MonitorSmartphone],
    ["appearance", "Darstellung", Star],
    ["training", "Training", Dumbbell],
    ["community", "Community", MessageCircle],
    ["notifications", "Meldungen", AlarmClock],
    ["controls", "Bedienung", Settings2],
    ["privacy", "Datenschutz", ShieldCheck],
    ["history", "Verlauf", History],
    ["support", "Hilfe", BookOpen],
  ] as const;
  if (pathname === "/profile" || pathname.startsWith("/settings/"))
    return {
      id: "settings",
      label: "Einstellungen",
      tabs: settingsIds.map(([id, label, Icon]) =>
        tab(id, label, Icon, { to: id === "profile" ? "/profile" : `/settings/${id}` }),
      ),
    };

  return null;
}

const GLOBAL_ITEMS = [
  { to: "/", label: "Startseite", icon: House },
  { to: "/ai", label: "Mira", icon: Sparkles },
  { to: "/chat", label: "Nexus Chat", icon: MessageCircle },
  { to: "/exercises", label: "Übungen", icon: Dumbbell },
  { to: "/profile", label: "Einstellungen", icon: Settings2 },
] as const;

/** App-specific glass tab bar. Home and fullscreen gameplay intentionally keep their own canvas/navigation. */
export function AppNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const context = getAppTabs(pathname);
  const [hash, setHash] = useState("");
  const [enabled, setEnabled] = useState(getNavigationVisible);
  const [layout, setLayout] = useState<NavigationLayoutId>(getStoredNavigationLayout);
  const [scrollVisible, setScrollVisible] = useState(true);

  useEffect(() => {
    const sync = () => {
      setEnabled(getNavigationVisible());
      setLayout(getStoredNavigationLayout());
      setScrollVisible(true);
    };
    sync();
    window.addEventListener("np-appearance-change", sync);
    return () => window.removeEventListener("np-appearance-change", sync);
  }, []);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.replace(/^#/, ""));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    setScrollVisible(true);
  }, [pathname]);

  useEffect(() => {
    const bottomLayout = layout === "bottom" || layout === "floating";
    if (!enabled || context || !bottomLayout) return;
    let state = { visible: true, anchorY: window.scrollY };
    const onScroll = () => {
      const y = window.scrollY;
      const focused =
        document.activeElement instanceof Element &&
        Boolean(document.activeElement.closest(".app-homebar"));
      state = updateNavigationForScroll(state, y, focused);
      setScrollVisible(state.visible);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, layout, pathname, context]);

  const hideModuleChrome = pathname.startsWith("/settings") || pathname.startsWith("/profile");
  const hideRouteChrome =
    pathname === "/" ||
    pathname.startsWith("/games") ||
    (pathname.startsWith("/battle/") && pathname !== "/battle/");
  const contextVisible = enabled && Boolean(context) && !hideModuleChrome && !hideRouteChrome;
  const bottomLayout = layout === "bottom" || layout === "floating";
  const barVisible = enabled && bottomLayout && scrollVisible && !hideModuleChrome;
  const globalVisible = barVisible && !context && !hideRouteChrome;
  const navigationVisible = contextVisible || globalVisible;

  useEffect(() => {
    document.documentElement.dataset.navigationExpanded = String(navigationVisible);
    document.documentElement.dataset.contextNavigation = String(contextVisible);
    document.documentElement.dataset.contextApp = contextVisible ? (context?.id ?? "") : "";
    return () => {
      document.documentElement.dataset.contextNavigation = "false";
      document.documentElement.dataset.contextApp = "";
    };
  }, [navigationVisible, contextVisible, context?.id]);

  if (contextVisible && context) {
    return (
      <nav className="app-homebar alo-context-tabbar" aria-label={`${context.label} Tabs`}>
        <ul className="ah-segment homebar-items alo-context-tab-items">
          {context.tabs.map((item) => {
            const targetHash = item.hash;
            const active = item.to
              ? pathname === item.to || pathname.startsWith(`${item.to}/`)
              : targetHash
                ? hash === targetHash
                : false;
            const className = `homebar-link ${active ? "is-active" : ""}`;
            const content = (
              <>
                <item.Icon className="homebar-icon" aria-hidden="true" />
                <span>{item.label}</span>
              </>
            );
            return (
              <li key={item.id} className="alo-context-tab-item">
                {targetHash ? (
                  <a
                    href={`#${targetHash}`}
                    aria-current={active ? "page" : undefined}
                    className={className}
                    onClick={(event) => {
                      const target = Array.from(
                        document.querySelectorAll<HTMLElement>("[id], [data-nav-target]"),
                      ).find((element) => {
                        const style = window.getComputedStyle(element);
                        return (
                          (element.id === targetHash || element.dataset.navTarget === targetHash) &&
                          element.getClientRects().length > 0 &&
                          style.visibility !== "hidden"
                        );
                      });
                      if (!target) return;
                      event.preventDefault();
                      window.history.replaceState(
                        window.history.state,
                        "",
                        `${window.location.pathname}${window.location.search}#${targetHash}`,
                      );
                      setHash(targetHash);
                      target.scrollIntoView({ behavior: "smooth", block: "start" });
                      if (target.tabIndex === -1) target.focus({ preventScroll: true });
                    }}
                  >
                    {content}
                  </a>
                ) : item.command ? (
                  <button
                    type="button"
                    className={className}
                    onClick={() => {
                      if (item.command?.startsWith("browser-")) {
                        window.dispatchEvent(
                          new CustomEvent("alo-browser-tab", { detail: item.command }),
                        );
                      } else {
                        window.dispatchEvent(
                          new CustomEvent("alo-page-sidebar-command", { detail: item.command }),
                        );
                      }
                    }}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    to={item.to as never}
                    aria-current={active ? "page" : undefined}
                    className={className}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      className="app-homebar"
      aria-label="Erweiterte Navigation"
      hidden={!globalVisible}
      inert={!globalVisible}
    >
      <ul className="ah-segment homebar-items">
        {GLOBAL_ITEMS.map((item) => {
          const active =
            pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`));
          return (
            <li key={item.to} className="min-w-0 flex-1">
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                aria-current={active ? "page" : undefined}
                className={`homebar-link ${active ? "is-active" : ""}`}
              >
                <item.icon className="homebar-icon" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Compatibility export; legacy imports never render an upper bar. */
export function TopNav() {
  return <AppNavigation />;
}

export function BottomNav() {
  return null;
}

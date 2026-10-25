import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { House, Dumbbell, Sparkles, MessageCircle, UserRound } from "lucide-react";
import {
  getStoredNavigationLayout,
  updateNavigationForScroll,
  type NavigationLayoutId,
} from "@/lib/navigation-layout";

const ITEMS = [
  { to: "/", label: "Startseite", icon: House },
  { to: "/ai", label: "Mira", icon: Sparkles },
  { to: "/chat", label: "Nexus Chat", icon: MessageCircle },
  { to: "/exercises", label: "Übungen", icon: Dumbbell },
  { to: "/profile", label: "Profil", icon: UserRound },
] as const;
/** Optional bottom navigation; the app-wide upper bar is intentionally absent. */
export function AppNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideModuleChrome =
    pathname.startsWith("/ai") ||
    pathname.startsWith("/exercises") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/profile");
  const [enabled, setEnabled] = useState(false);
  const [layout, setLayout] = useState<NavigationLayoutId>(getStoredNavigationLayout);
  const [scrollVisible, setScrollVisible] = useState(true);
  useEffect(() => {
    const sync = () => {
      let value = false;
      try {
        value = window.localStorage.getItem("alo-navigation-visible") === "true";
      } catch {
        /* use compact default */
      }
      setEnabled(value);
      setLayout(getStoredNavigationLayout());
      setScrollVisible(true);
    };
    sync();
    window.addEventListener("np-appearance-change", sync);
    return () => window.removeEventListener("np-appearance-change", sync);
  }, []);
  useEffect(() => {
    setScrollVisible(true);
  }, [pathname]);
  useEffect(() => {
    if (!enabled || (layout !== "bottom" && layout !== "floating")) return;
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
  }, [enabled, layout, pathname]);
  const bottomLayout = layout === "bottom" || layout === "floating";
  const barVisible = enabled && bottomLayout && scrollVisible && !hideModuleChrome;
  useEffect(() => {
    document.documentElement.dataset.navigationExpanded = String(barVisible);
  }, [barVisible]);
  return (
    <nav
      className="app-homebar"
      aria-label="Erweiterte Navigation"
      hidden={!barVisible}
      inert={!barVisible}
    >
      <ul className="ah-segment homebar-items">
        {ITEMS.map((it) => {
          const active =
            pathname === it.to ||
            pathname.startsWith(`${it.to}/`) ||
            (it.to === "/exercises" &&
              ["/workout/", "/programs", "/calisthenics", "/cali-workout/", "/run"].some((prefix) =>
                pathname.startsWith(prefix),
              )) ||
            (it.to === "/ai" && pathname === "/coach");
          return (
            <li key={it.to} className="min-w-0 flex-1">
              <Link
                to={it.to}
                activeOptions={{ exact: it.to === "/" }}
                aria-current={active ? "page" : undefined}
                className={`homebar-link ${active ? "is-active" : ""}`}
              >
                <it.icon className="homebar-icon" aria-hidden="true" />
                <span>{it.label}</span>
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

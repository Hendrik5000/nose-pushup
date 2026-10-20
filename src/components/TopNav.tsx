import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { House, Dumbbell, Sparkles, MessageCircle, UserRound, Settings2 } from "lucide-react";
import { updateNavigationForScroll } from "@/lib/navigation-layout";
import { useAutoHideModuleMenu } from "@/hooks/useAutoHideModuleMenu";

const ITEMS = [
  { to: "/", label: "Training", icon: House },
  { to: "/ai", label: "Mira", icon: Sparkles },
  { to: "/chat", label: "Nexus Chat", icon: MessageCircle },
  { to: "/exercises", label: "Übungen", icon: Dumbbell },
  { to: "/profile", label: "Profil", icon: UserRound },
] as const;
const MODULES = [
  { to: "/", label: "Training" },
  { to: "/ai", label: "Mira" },
  { to: "/chat", label: "Nexus" },
] as const;

/** Slim keyboard-accessible module switcher remains available when the full nav is hidden. */
export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideModuleChrome =
    pathname.startsWith("/ai") ||
    pathname.startsWith("/exercises") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/profile");
  const moduleMenu = useAutoHideModuleMenu(pathname);
  const [enabled, setEnabled] = useState(false);
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
    if (!enabled) return;
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
  }, [enabled, pathname]);
  const barVisible = enabled && scrollVisible && !hideModuleChrome;
  useEffect(() => {
    document.documentElement.dataset.navigationExpanded = String(barVisible);
  }, [barVisible]);
  return (
    <>
      <nav
        ref={moduleMenu.menuRef}
        className="alo-module-switcher"
        aria-label="Alo · Module"
        data-visible={hideModuleChrome ? "false" : moduleMenu.visible}
        hidden={hideModuleChrome}
        {...(hideModuleChrome ? { inert: true } : {})}
        onFocusCapture={moduleMenu.reveal}
        onBlurCapture={moduleMenu.scheduleHide}
        onPointerMove={moduleMenu.reveal}
      >
        {MODULES.map((module) => {
          const active = module.to === "/" ? pathname === "/" : pathname === module.to;
          return (
            <Link
              key={module.to}
              to={module.to}
              aria-current={active ? "page" : undefined}
              className={`alo-module-link ${active ? "is-active" : ""}`}
            >
              {module.label}
            </Link>
          );
        })}
        <Link
          to="/profile"
          className="alo-module-settings"
          aria-label="Einstellungen und Profil"
          aria-current={pathname === "/profile" ? "page" : undefined}
        >
          <Settings2 aria-hidden="true" />
        </Link>
      </nav>
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
                ["/workout/", "/programs", "/calisthenics", "/cali-workout/", "/run"].some(
                  (prefix) => pathname.startsWith(prefix),
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
    </>
  );
}

/** Compatibility export; authenticated layout renders navigation only once. */
export function BottomNav() {
  return null;
}

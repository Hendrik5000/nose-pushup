import { Link, useRouterState } from "@tanstack/react-router";
import { House, Dumbbell, Sparkles, MessageCircle, UserRound } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Übersicht", icon: House },
  { to: "/exercises", label: "Training", icon: Dumbbell },
  { to: "/ai", label: "KI-Coach", icon: Sparkles },
  { to: "/chat", label: "Community", icon: MessageCircle },
  { to: "/profile", label: "Profil", icon: UserRound },
];

/** One shared homebar; position and variant are controlled by the saved layout. */
export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="app-homebar" aria-label="Hauptnavigation">
      <ul className="ah-segment homebar-items">
        {ITEMS.map((it) => {
          const active =
            it.to === "/"
              ? pathname === "/" || pathname === ""
              : pathname === it.to ||
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
  );
}

/** Navigation is rendered once by AuthenticatedLayout, not by individual pages. */
export function BottomNav() {
  return null;
}

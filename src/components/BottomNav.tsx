import { Link, useRouterState } from "@tanstack/react-router";

type Item = { to: string; label: string };

/** Apple Health–style segmented control at the top. */
const ITEMS: Item[] = [
  { to: "/", label: "Übersicht" },
  { to: "/exercises", label: "Training" },
  { to: "/ai", label: "Super-AI" },
  { to: "/chat", label: "Chat" },
  { to: "/profile", label: "Profil" },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="sticky top-0 z-40 -mx-5 mb-2 border-b border-white/5 bg-black/70 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl"
      aria-label="Hauptnavigation"
    >
      <ul className="ah-segment mx-auto max-w-md">
        {ITEMS.map((it) => {
          const active =
            it.to === "/"
              ? pathname === "/" || pathname === ""
              : pathname === it.to || pathname.startsWith(`${it.to}/`);
          return (
            <li key={it.to} className="min-w-0 flex-1">
              <Link
                to={it.to}
                activeOptions={{ exact: it.to === "/" }}
                aria-current={active ? "page" : undefined}
                className={`block w-full truncate ${active ? "is-active" : ""}`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

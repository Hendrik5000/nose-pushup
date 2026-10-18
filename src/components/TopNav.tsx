import { Link, useRouterState } from "@tanstack/react-router";

type Item = { to: string; label: string };

const ITEMS: Item[] = [
  { to: "/", label: "Übersicht" },
  { to: "/exercises", label: "Training" },
  { to: "/ai", label: "Super-AI" },
  { to: "/chat", label: "Chat" },
  { to: "/profile", label: "Profil" },
];

/** Apple Health–style segmented control, fixed at the top. */
export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pb-2 pt-[max(0.35rem,env(safe-area-inset-top))]"
      aria-label="Hauptnavigation"
    >
      <ul className="ah-segment pointer-events-auto w-full max-w-md shadow-lg shadow-black/40">
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

/** @deprecated Use TopNav — kept so existing imports keep working. */
export function BottomNav() {
  return null;
}

import { Link, useRouterState } from "@tanstack/react-router";

type Item = { to: string; label: string };

/** Apple Health–style segmented control, placed at the bottom. */
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
    <>
      <div className="h-24" aria-hidden />
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-label="Hauptnavigation"
      >
        <ul className="ah-segment pointer-events-auto">
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
    </>
  );
}

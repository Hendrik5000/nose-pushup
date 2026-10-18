import { Link, useRouterState } from "@tanstack/react-router";

type Item = { to: string; label: string };

/** Apple Health–style segmented control, fixed at the top. */
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
      {/* Spacer so page content clears the fixed bar */
      }
      <div className="h-[calc(3.25rem+env(safe-area-inset-top))]" aria-hidden />
      <nav
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center bg-gradient-to-b from-black/90 via-black/80 to-black/40 px-4 pb-2 pt-[max(0.4rem,env(safe-area-inset-top))] backdrop-blur-xl"
        aria-label="Hauptnavigation"
      >
        <ul className="ah-segment pointer-events-auto w-full max-w-md">
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

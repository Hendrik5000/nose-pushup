import { Link, useRouterState } from "@tanstack/react-router";

type Item = { to: string; icon: string; label: string };

const ITEMS: Item[] = [
  { to: "/", icon: "⌂", label: "Home" },
  { to: "/exercises", icon: "◎", label: "Training" },
  { to: "/ai", icon: "✦", label: "Super-AI" },
  { to: "/chat", icon: "◉", label: "Chat" },
  { to: "/profile", icon: "○", label: "Profil" },
];

/** Samsung Health–style floating bottom tab bar (always bottom). */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <div className="h-28" aria-hidden />
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
        aria-label="Hauptnavigation"
      >
        <ul className="pointer-events-auto flex w-full max-w-md items-stretch justify-between gap-0.5 rounded-[1.75rem] border border-white/10 bg-[oklch(0.18_0.02_260/0.82)] p-1.5 shadow-[0_12px_40px_-8px_oklch(0_0_0/0.65)] backdrop-blur-2xl">
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
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-[1.35rem] px-1 py-2.5 transition-all duration-200 ${
                    active
                      ? "bg-primary/18 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`text-[1.15rem] leading-none transition-transform duration-200 ${
                      active ? "scale-110" : ""
                    }`}
                    aria-hidden
                  >
                    {it.icon}
                  </span>
                  <span
                    className={`max-w-full truncate text-[9px] font-semibold tracking-wide ${
                      active ? "opacity-100" : "opacity-70"
                    }`}
                  >
                    {it.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

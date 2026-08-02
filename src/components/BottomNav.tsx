import { Link } from "@tanstack/react-router";

type Item = { to: string; icon: string; label: string };

const ITEMS: Item[] = [
  { to: "/", icon: "🏠", label: "Start" },
  { to: "/run", icon: "🏃", label: "Laufen" },
  { to: "/coach", icon: "🤖", label: "Coach" },
  { to: "/leaderboard", icon: "👥", label: "Together" },
  { to: "/profile", icon: "🙋", label: "Ich" },
];

/** Samsung-Health-style persistent bottom tab bar. */
export function BottomNav() {
  return (
    <>
      <div className="h-28" aria-hidden />
      <nav className="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
        <ul className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-1 rounded-full border border-border/60 bg-card/60 p-1.5 shadow-[0_12px_40px_-12px_oklch(0_0_0/0.7)] backdrop-blur-2xl">
          {ITEMS.map((it) => (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                activeOptions={{ exact: it.to === "/" }}
                className="group relative flex flex-col items-center gap-0.5 rounded-full px-2 py-2 text-muted-foreground transition-all duration-300 [&.active]:bg-primary/12 [&.active]:text-primary"
              >
                <span className="text-lg leading-none transition-transform duration-300 group-[.active]:-translate-y-px group-[.active]:scale-110">
                  {it.icon}
                </span>
                <span className="max-h-0 overflow-hidden text-[9px] font-medium tracking-wide opacity-0 transition-all duration-300 group-[.active]:max-h-4 group-[.active]:opacity-100">
                  {it.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

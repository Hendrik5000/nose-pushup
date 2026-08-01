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
      <div className="h-24" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl">
        <ul className="mx-auto flex w-full max-w-md items-stretch justify-between px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {ITEMS.map((it) => (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                activeOptions={{ exact: it.to === "/" }}
                className="flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition [&.active]:text-primary"
              >
                <span className="text-xl leading-none">{it.icon}</span>
                <span className="tracking-wide">{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

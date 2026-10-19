import { Link } from "@tanstack/react-router";

const ACTIONS = [
  { to: "/ai" as const, label: "Super-AI", icon: "✦" },
  { to: "/health" as const, label: "Gesundheit", icon: "💚" },
  { to: "/chat" as const, label: "Chat", icon: "💬" },
];

export function QuickActionsBar() {
  return (
    <section className="mt-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Schnellaktionen
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card/50 py-3 text-[10px] font-medium transition active:scale-[0.97]"
          >
            <span className="text-xl leading-none">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

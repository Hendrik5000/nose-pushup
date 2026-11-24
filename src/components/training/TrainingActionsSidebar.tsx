import { Link } from "@tanstack/react-router";

const TRAINING_NAV_ITEMS = [
  { id: "training", label: "Trainingsübersicht", to: "/training" },
  { id: "programs", label: "Programme", to: "/programs" },
  { id: "exercises", label: "Übungen", to: "/exercises" },
  { id: "coach", label: "Coach", to: "/coach" },
] as const;

type TrainingNavItemId = (typeof TRAINING_NAV_ITEMS)[number]["id"];

export function TrainingActionsSidebar({ activePage }: { activePage: TrainingNavItemId }) {
  const linkClass =
    "flex min-h-11 min-w-0 items-center rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm";

  return (
    <nav aria-label="Trainingsnavigation">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Training
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 lg:grid-cols-1">
        {TRAINING_NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          const stateClass = isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-card hover:text-foreground";

          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              className={`${linkClass} ${stateClass}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

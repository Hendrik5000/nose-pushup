import { Link, createFileRoute } from "@tanstack/react-router";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import { HOME_OTHER_AREAS } from "@/lib/home-app-menus";

export const Route = createFileRoute("/_authenticated/areas")({
  head: () => ({
    meta: [
      { title: "Weitere Bereiche — Alo" },
      { name: "description", content: "Alle weiteren Trainings-, Gesundheits- und Alo-Bereiche." },
    ],
  }),
  component: MoreAreasPage,
});

function MoreAreasPage() {
  return (
    <HomeAppMenuLayout
      eyebrow="ALO · APPS"
      title="Weitere Bereiche"
      description="Öffne einen Bereich direkt. Deine bisherigen Alo-Ziele bleiben alle hier erreichbar."
    >
      <nav
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
        aria-label="Alle weiteren Alo-Bereiche"
      >
        {HOME_OTHER_AREAS.map(({ to, label, icon: Icon, description }) => (
          <Link
            key={to}
            to={to}
            aria-label={`${label} öffnen`}
            className="group flex min-h-32 flex-col justify-between rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm transition hover:border-primary/45 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-36 sm:p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-4 block">
              <span className="block text-sm font-bold leading-tight">{label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </nav>
    </HomeAppMenuLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import { ALO_WORKSPACE_MENU_ORDER, ALO_WORKSPACE_TOOLS } from "@/lib/home-app-menus";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Alo-Werkzeuge — Alo" },
      { name: "description", content: "Schnellzugriffe auf die vorhandenen Alo-Werkzeuge." },
    ],
  }),
  component: AloToolsPage,
});

const orderedTools = ALO_WORKSPACE_MENU_ORDER.map((id) =>
  ALO_WORKSPACE_TOOLS.find((tool) => tool.id === id)!,
);

function AloToolsPage() {
  const openTool = (toolId: (typeof orderedTools)[number]["id"]) => {
    window.dispatchEvent(new CustomEvent("alo-open", { detail: toolId }));
  };

  return (
    <HomeAppMenuLayout
      eyebrow="ALO · APPS"
      title="Alo-Werkzeuge"
      description="Wähle ein Werkzeug. Jeder Schnellzugriff öffnet die bestehende Alo-Funktion im eigenen Werkzeugmenü."
    >
      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4" aria-label="Alo-Werkzeuge">
        {orderedTools.map(({ id, label, icon: Icon, description }) => (
          <button
            key={id}
            type="button"
            onClick={() => openTool(id)}
            aria-label={`${label} öffnen`}
            className="group flex min-h-24 items-center gap-4 rounded-2xl border border-border/70 bg-card/75 p-4 text-left shadow-sm transition hover:border-primary/45 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-28 sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-tight">{label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {description}
              </span>
            </span>
          </button>
        ))}
      </nav>
    </HomeAppMenuLayout>
  );
}

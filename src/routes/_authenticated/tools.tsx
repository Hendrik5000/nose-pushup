import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import {
  ALO_WORKSPACE_MENU_ORDER,
  ALO_WORKSPACE_TOOLS,
  type AloWorkspaceToolId,
} from "@/lib/home-app-menus";

function isWorkspaceToolId(value: unknown): value is AloWorkspaceToolId {
  return ALO_WORKSPACE_TOOLS.some((tool) => tool.id === value);
}

export const Route = createFileRoute("/_authenticated/tools")({
  validateSearch: (search: Record<string, unknown>): { tool?: AloWorkspaceToolId } =>
    isWorkspaceToolId(search.tool) ? { tool: search.tool } : {},
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
  const { tool } = Route.useSearch();
  useEffect(() => {
    if (!tool) return;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("alo-open", { detail: tool }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tool]);

  return (
    <HomeAppMenuLayout
      eyebrow="ALO · APPS"
      title="Alo-Werkzeuge"
      description="Wähle ein Werkzeug. Jeder Schnellzugriff öffnet die bestehende Alo-Funktion im eigenen Werkzeugmenü."
      sidebar={
        <div className="flex flex-col gap-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Aktionen
          </p>
          <Link
            to="/areas"
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-card"
          >
            Weitere Bereiche
          </Link>
          <Link
            to="/marketplace"
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-card"
          >
            Marketplace
          </Link>
        </div>
      }
    >
      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4" aria-label="Alo-Werkzeuge">
        {orderedTools.map(({ id, label, icon: Icon, description }) => (
          <Link
            key={id}
            to="/tools"
            search={{ tool: id }}
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
          </Link>
        ))}
      </nav>
    </HomeAppMenuLayout>
  );
}

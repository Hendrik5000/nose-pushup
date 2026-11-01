import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import { AloHomeLink } from "@/components/AloHomeLink";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (!(await getAdminAreaAccess())) throw redirect({ to: "/" });
  },
  component: AdminOverview,
});

function AdminOverview() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-5">
      <AloHomeLink />
      <header className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Alo</p>
            <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Der Admin-Bereich ist vorbereitet. Neue Verwaltungsfunktionen werden hier ergänzt und
          serverseitig nach Berechtigung geprüft.
        </p>
      </header>

      <section
        aria-labelledby="admin-sections-title"
        className="rounded-3xl border border-border bg-card/45 p-5 sm:p-7"
      >
        <h2 id="admin-sections-title" className="text-lg font-semibold">
          Verwaltungsbereiche
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Aktuell sind noch keine Verwaltungsfunktionen verfügbar.
        </p>
      </section>
    </main>
  );
}

import { Link, createFileRoute } from "@tanstack/react-router";
import { AppSettingsPage } from "@/components/settings/AppSettingsPage";
import { isFullScreenAppSettingsId, resolveAppSettingsReturnTarget } from "@/lib/app-settings";

export const Route = createFileRoute("/_authenticated/settings/apps/$appId")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" ? search.from : "",
  }),
  head: ({ params }) => ({
    meta: [{ title: `${params.appId} Einstellungen — Alo` }],
  }),
  component: AppSettingsRoute,
});

function AppSettingsRoute() {
  const { appId } = Route.useParams();
  const { from } = Route.useSearch();
  const { user } = Route.useRouteContext();

  if (!isFullScreenAppSettingsId(appId)) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-4 px-4 py-6 pb-28 sm:px-8">
        <h1 className="text-2xl font-bold">Keine separate Einstellungsseite</h1>
        <p className="text-sm text-muted-foreground">
          Diese App hat keine eigene Einstellungsansicht. Öffne die passende App direkt aus der
          Apps-Liste.
        </p>
        {appId === "alarm" ? (
          <Link to="/alarm" className="min-h-11 text-sm font-semibold text-primary">
            Wecker-Einstellungen öffnen
          </Link>
        ) : null}
        <Link
          to="/settings/$category"
          params={{ category: "apps" }}
          className="min-h-11 text-sm font-semibold text-primary"
        >
          Zurück zu Apps
        </Link>
      </main>
    );
  }

  return (
    <AppSettingsPage
      appId={appId}
      userId={user.id}
      returnTo={resolveAppSettingsReturnTarget(appId, from)}
    />
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicProfile } from "@/lib/public-profile.functions";

export const Route = createFileRoute("/u/$slug")({
  loader: ({ params }) => getPublicProfile({ data: { slug: params.slug } }),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Nosy Push-Ups Profil` },
      {
        name: "description",
        content: `Öffentliches Trainingsprofil von ${params.slug}: Level, Streak, Bestwert und Battle-Siege.`,
      },
      { property: "og:title", content: `${params.slug} — Nosy Push-Ups Profil` },
      {
        property: "og:description",
        content: "Level, Streak, Bestwert und Battle-Siege ansehen.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">Profil konnte nicht geladen werden.</p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">Dieses Profil gibt es nicht.</p>
    </Shell>
  ),
  component: PublicProfilePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-5 py-10">
      {children}
    </main>
  );
}

function PublicProfilePage() {
  const profile = Route.useLoaderData();
  const { slug } = Route.useParams();

  if (!profile) {
    return (
      <Shell>
        <div className="rounded-3xl border border-border bg-card/60 p-6 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 text-lg font-semibold">Profil nicht öffentlich</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            „{slug}" gibt es nicht oder das Profil ist privat.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Zur App
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-3xl border border-border bg-card/60 p-6 text-center backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-2xl font-bold">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile.display_name || "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight">
          {profile.display_name || slug}
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Level {profile.level}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <Stat label="Bestwert" value={`${profile.best_count}`} icon="🏆" />
          <Stat label="Streak" value={`${profile.current_streak} Tage`} icon="🔥" />
          <Stat label="Längste Serie" value={`${profile.longest_streak} Tage`} icon="📈" />
          <Stat label="Battle-Siege" value={`${profile.battle_wins}`} icon="⚔️" />
        </div>

        <Link
          to="/auth"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          Selbst mittrainieren →
        </Link>
      </div>
    </Shell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-3">
      <div className="text-lg leading-none">{icon}</div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

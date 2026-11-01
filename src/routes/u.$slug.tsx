import { DesignView } from "@/components/DesignView";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicProfile } from "@/lib/public-profile.functions";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";

export const Route = createFileRoute("/u/$slug")({
  loader: ({ params }) => getPublicProfile({ data: { slug: params.slug } }),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Alo · Öffentliches Trainingsprofil` },
      {
        name: "description",
        content: `Öffentliches Trainingsprofil von ${params.slug}: Level, Streak, Bestwert und Battle-Siege.`,
      },
      { property: "og:title", content: `${params.slug} — Alo · Öffentliches Trainingsprofil` },
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
    <>
      <div className="classic-only">
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
            <p className="text-xs uppercase tracking-[0.25em] text-primary">
              Level {profile.level}
            </p>

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
      </div>
      <DesignView variant="sport">
        <main className="sport-only sport-public-profile mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-6 px-5 py-8 sm:px-8">
          <SportPageIntro
            eyebrow="ÖFFENTLICHES TRAININGSPROFIL"
            title="Trainingsprofil"
            description="Öffentliche Bestwerte und Trainingserfolge."
          />
          <section className="relative overflow-hidden rounded-[2.25rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-card/85 to-background p-7 shadow-sm sm:p-10">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-primary/30 bg-background/70 text-4xl font-bold">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (profile.display_name || "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Level {profile.level} · Trainingslevel
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  {profile.display_name || slug}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Öffentliches Trainingsprofil von @{slug}
                </p>
              </div>
            </div>
          </section>
          <SportSectionLabel number="01">Leistungsübersicht</SportSectionLabel>
          <section className="grid gap-3 sm:grid-cols-2">
            {[
              ["Bestwert", `${profile.best_count}`, "🏆"],
              ["Aktuelle Serie", `${profile.current_streak} Tage`, "🔥"],
              ["Längste Serie", `${profile.longest_streak} Tage`, "↗"],
              ["Battle-Siege", `${profile.battle_wins}`, "⚔️"],
            ].map(([label, value, icon]) => (
              <div key={label} className="rounded-[1.75rem] border border-border/70 bg-card/75 p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-xl">{icon}</span>
                </div>
                <div className="mt-4 text-3xl font-bold tabular-nums">{value}</div>
              </div>
            ))}
          </section>
          <Link
            to="/auth"
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground"
          >
            Selbst mittrainieren →
          </Link>
        </main>
      </DesignView>
    </>
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

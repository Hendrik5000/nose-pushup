import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, CircleDot, Flame, Trophy } from "lucide-react";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";

export const Route = createFileRoute("/sports")({
  head: () => ({
    meta: [
      { title: "Alo Sports" },
      { name: "description", content: "Spieltag, Tabelle und persönliche Sportstatistiken." },
    ],
  }),
  component: SportsPage,
});

const matches = [
  ["Frankfurt", "Leipzig", "18:30"],
  ["Leverkusen", "Stuttgart", "20:30"],
  ["Bremen", "Gladbach", "Sa · 15:30"],
] as const;

function SportsPage() {
  return (
    <HomeAppMenuLayout
      eyebrow="ALO SPORTS · BUNDESLIGA"
      title="Spiele & Live"
      description="Dein kompakter Match Hub für Spieltag, Tabelle und Fortschritt."
    >
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Sportbereiche">
        {["Spiele & Live", "Tabelle", "Statistik"].map((tab, index) => (
          <span
            key={tab}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${index === 0 ? "bg-primary text-primary-foreground" : "border border-border/70 bg-card/60 text-muted-foreground"}`}
          >
            {tab}
          </span>
        ))}
      </nav>

      <section
        className="overflow-hidden rounded-3xl border border-emerald-400/25 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.25),transparent_45%),linear-gradient(135deg,#102c2b,#0d171c)] p-5 text-white shadow-lg sm:p-7"
        aria-labelledby="live-title"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            <CircleDot className="h-3.5 w-3.5" /> Live · 74’
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75">
            Bundesliga
          </span>
        </div>
        <h2 id="live-title" className="mt-5 text-xl font-bold sm:text-2xl">
          Dortmund <span className="text-emerald-300">2 : 1</span> FC Bayern
        </h2>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm text-white/70">
          <div>
            <strong className="block text-lg text-white">54%</strong>Ballbesitz
          </div>
          <div>
            <strong className="block text-lg text-white">8 : 5</strong>Torschüsse
          </div>
          <div>
            <strong className="block text-lg text-white">4 : 2</strong>Ecken
          </div>
        </div>
      </section>

      <section aria-labelledby="matchday-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="matchday-title" className="text-lg font-bold">
            Nächste Spiele
          </h2>
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {matches.map(([home, away, time]) => (
            <article key={home} className="rounded-2xl border border-border/70 bg-card/70 p-4">
              <p className="text-xs text-muted-foreground">{time}</p>
              <p className="mt-3 font-semibold">{home}</p>
              <p className="text-sm text-muted-foreground">vs. {away}</p>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                Details <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-border/70 bg-card/70 p-5"
          aria-labelledby="table-title"
        >
          <div className="flex items-center justify-between">
            <h2 id="table-title" className="font-bold">
              Tabelle
            </h2>
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {[
              ["1", "Bayern", "28"],
              ["2", "Dortmund", "26"],
              ["3", "Leverkusen", "24"],
            ].map(([rank, team, points]) => (
              <div key={team} className="flex items-center gap-3">
                <span className="w-5 text-muted-foreground">{rank}</span>
                <span className="flex-1 font-medium">{team}</span>
                <span className="font-bold">{points} Pkt.</span>
              </div>
            ))}
          </div>
        </section>
        <section
          className="rounded-2xl border border-border/70 bg-card/70 p-5"
          aria-labelledby="stats-title"
        >
          <div className="flex items-center justify-between">
            <h2 id="stats-title" className="font-bold">
              Deine Statistik
            </h2>
            <Flame className="h-5 w-5 text-orange-400" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <strong className="block text-2xl">12</strong>
              <span className="text-xs text-muted-foreground">Tipps richtig</span>
            </div>
            <div className="rounded-xl bg-primary/10 p-3">
              <strong className="block text-2xl">68%</strong>
              <span className="text-xs text-muted-foreground">Trefferquote</span>
            </div>
          </div>
        </section>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Diese erste Version arbeitet mit kuratierten Matchdaten. Live-Datenquellen werden erst
        ergänzt, wenn sie im Alo-Backend sicher angebunden und geprüft sind.
      </p>
      <Link to="/marketplace" className="text-sm font-semibold text-primary hover:underline">
        Zurück zum Marketplace
      </Link>
    </HomeAppMenuLayout>
  );
}

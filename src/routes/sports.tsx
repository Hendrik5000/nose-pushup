import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, CircleDot, Flame, Trophy } from "lucide-react";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import {
  FOOTBALL_LEAGUES,
  NATIONAL_TEAM_ID,
  currentFootballSeason,
  footballApiUrl,
  footballMatchesPath,
  footballTablePath,
  formatKickOff,
  nationalApiUrl,
  parseFootballMatches,
  parseFootballTable,
  parseNationalEvents,
  type FootballLeague,
  type FootballMatch,
  type FootballTableRow,
} from "@/lib/football";

export const Route = createFileRoute("/sports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Alo Sports" },
      {
        name: "description",
        content: "Spieltag, Tabelle und persönliche Sportstatistiken.",
      },
    ],
  }),
  component: SportsPage,
});

function latestMatchday(matches: FootballMatch[]): number {
  const open = matches.find((match) => !match.finished);
  if (open) return open.groupOrder;
  return matches.reduce((max, match) => Math.max(max, match.groupOrder), 0);
}

function nextMatches(matches: FootballMatch[], matchday: number, limit = 3): FootballMatch[] {
  const now = Date.now();
  const upcoming = matches.filter((match) => match.groupOrder === matchday && !match.finished);
  const pool = upcoming.length > 0 ? upcoming : matches.filter((match) => !match.finished);
  return pool
    .filter((match) => !match.kickOffUtc || new Date(match.kickOffUtc).getTime() >= now)
    .slice(0, limit);
}

function lastFinishedMatch(matches: FootballMatch[], matchday: number): FootballMatch | null {
  const finished = matches.filter((match) => match.groupOrder === matchday && match.finished);
  if (finished.length === 0) return null;
  return finished[finished.length - 1];
}

function SportsPage() {
  const season = currentFootballSeason();
  const [leagueId, setLeagueId] = useState("bl1");
  const [table, setTable] = useState<FootballTableRow[]>([]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const league = FOOTBALL_LEAGUES.find((entry) => entry.id === leagueId) ?? FOOTBALL_LEAGUES[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const activeLeague =
      FOOTBALL_LEAGUES.find((entry) => entry.id === leagueId) ?? FOOTBALL_LEAGUES[0];
    const isNational = activeLeague.id === "deutschland";
    const requests: [Promise<unknown>, Promise<unknown>] = [
      activeLeague.hasTable
        ? fetch(footballApiUrl(footballTablePath(leagueId, season)))
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
      isNational
        ? Promise.all([
            fetch(nationalApiUrl(`eventsnext.php?id=${NATIONAL_TEAM_ID}`))
              .then((response) => (response.ok ? response.json() : null))
              .catch(() => null),
            fetch(nationalApiUrl(`eventslast.php?id=${NATIONAL_TEAM_ID}`))
              .then((response) => (response.ok ? response.json() : null))
              .catch(() => null),
          ]).then(([nextValue, lastValue]) => [
            ...parseNationalEvents(nextValue),
            ...parseNationalEvents(lastValue),
          ])
        : fetch(footballApiUrl(footballMatchesPath(leagueId, season)))
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null),
    ];
    void Promise.all(requests).then(([tableValue, matchValue]) => {
      if (!active) return;
      const parsedTable = parseFootballTable(tableValue);
      const parsedMatches = Array.isArray(matchValue)
        ? (matchValue as FootballMatch[])
        : parseFootballMatches(matchValue);
      setTable(parsedTable);
      setMatches(parsedMatches);
      if (parsedMatches.length === 0 && (!activeLeague.hasTable || parsedTable.length === 0)) {
        setError(
          activeLeague.hasTable
            ? "Die Bundesliga-Daten sind gerade nicht erreichbar. Bitte versuche es später erneut."
            : `Für ${activeLeague.name} sind aktuell keine Spiele in TheSportsDB eingetragen.`,
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [season, leagueId]);

  const matchday = latestMatchday(matches);
  const matchdayLabel =
    matches.find((match) => match.groupOrder === matchday)?.groupName ||
    (matchday > 0 && league.id !== "deutschland" ? `${matchday}. Spieltag` : "");
  const highlight = lastFinishedMatch(matches, matchday);
  const upcoming = nextMatches(matches, matchday);
  const matchdayMatches = matches.filter((match) => match.groupOrder === matchday);
  const finishedCount = matchdayMatches.filter((match) => match.finished).length;
  const goalsCount = matchdayMatches.reduce(
    (sum, match) => sum + (match.homeGoals ?? 0) + (match.awayGoals ?? 0),
    0,
  );

  return (
    <HomeAppMenuLayout
      eyebrow="ALO SPORTS · FUSSBALL"
      title="Spiele & Live"
      description={`${league.name} der Saison ${season}/${String(season + 1).slice(2)} — ${league.id === "deutschland" ? "live von TheSportsDB" : "live von OpenLigaDB"}.`}
    >
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Ligaauswahl">
        {FOOTBALL_LEAGUES.map((entry: FootballLeague) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setLeagueId(entry.id)}
            aria-pressed={entry.id === league.id}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${entry.id === league.id ? "bg-primary text-primary-foreground" : "border border-border/70 bg-card/60 text-muted-foreground"}`}
          >
            {entry.name}
          </button>
        ))}
      </nav>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Bundesliga-Daten werden geladen …</p>
      )}

      {!loading && !error && (
        <>
          <section
            className="overflow-hidden rounded-3xl border border-emerald-400/25 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.25),transparent_45%),linear-gradient(135deg,#102c2b,#0d171c)] p-5 text-white shadow-lg sm:p-7"
            aria-labelledby="matchday-title"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                <CircleDot className="h-3.5 w-3.5" /> {matchdayLabel || "Bundesliga"}
              </p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75">
                {league.name}
              </span>
            </div>
            {highlight ? (
              <>
                <h2 id="matchday-title" className="mt-5 text-xl font-bold sm:text-2xl">
                  {highlight.home}{" "}
                  <span className="text-emerald-300">
                    {highlight.homeGoals ?? 0} : {highlight.awayGoals ?? 0}
                  </span>{" "}
                  {highlight.away}
                </h2>
                <p className="mt-2 text-xs uppercase tracking-wide text-emerald-300">
                  Beendet · Letztes Ergebnis
                </p>
              </>
            ) : (
              <h2 id="matchday-title" className="mt-5 text-xl font-bold sm:text-2xl">
                Noch kein Spiel beendet
              </h2>
            )}
            <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm text-white/70">
              <div>
                <strong className="block text-lg text-white">{matchdayMatches.length}</strong>
                Spiele
              </div>
              <div>
                <strong className="block text-lg text-white">
                  {finishedCount}/{matchdayMatches.length}
                </strong>
                Beendet
              </div>
              <div>
                <strong className="block text-lg text-white">{goalsCount}</strong>
                Tore
              </div>
            </div>
          </section>

          <section aria-labelledby="upcoming-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="upcoming-title" className="text-lg font-bold">
                Nächste Spiele
              </h2>
              <Activity className="h-5 w-5 text-primary" />
            </div>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
                Keine angesetzten Spiele in den geladenen Daten.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {upcoming.map((match) => (
                  <article
                    key={match.id}
                    className="rounded-2xl border border-border/70 bg-card/70 p-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      {formatKickOff(match.kickOffUtc)}
                    </p>
                    <p className="mt-3 font-semibold">{match.home}</p>
                    <p className="text-sm text-muted-foreground">vs. {match.away}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {league.hasTable && (
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
                {table.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Keine Tabellendaten verfügbar.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3 text-sm">
                    {table.slice(0, 5).map((row) => (
                      <div key={row.name} className="flex items-center gap-3">
                        <span className="w-5 text-muted-foreground">{row.position}</span>
                        <span className="flex-1 font-medium">{row.name}</span>
                        <span className="text-muted-foreground">{row.matches} Sp.</span>
                        <span className="font-bold">{row.points} Pkt.</span>
                      </div>
                    ))}
                  </div>
                )}
                {league.id === "bl1" && (
                  <Link
                    to="/football"
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Gesamte Tabelle in Alo Fußball <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </section>
              <section
                className="rounded-2xl border border-border/70 bg-card/70 p-5"
                aria-labelledby="stats-title"
              >
                <div className="flex items-center justify-between">
                  <h2 id="stats-title" className="font-bold">
                    Spieltag-Statistik
                  </h2>
                  <Flame className="h-5 w-5 text-orange-400" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <strong className="block text-2xl">{goalsCount}</strong>
                    <span className="text-xs text-muted-foreground">Tore am Spieltag</span>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-3">
                    <strong className="block text-2xl">
                      {finishedCount}/{matchdayMatches.length}
                    </strong>
                    <span className="text-xs text-muted-foreground">Spiele beendet</span>
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Diese Seite zeigt echte Fußball-Daten von OpenLigaDB und TheSportsDB. Live-Spielminuten oder
        Zwischenstände während laufender Spiele bieten die Quellen nicht an; angezeigt werden
        Ergebnisse beendeter Spiele und die aktuellen Ansetzungen.
      </p>
      <Link to="/marketplace" className="text-sm font-semibold text-primary hover:underline">
        Zurück zum Marketplace
      </Link>
    </HomeAppMenuLayout>
  );
}

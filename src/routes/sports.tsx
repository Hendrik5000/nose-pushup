import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, CircleDot, Star, Trophy, X } from "lucide-react";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import { StandaloneAppShell } from "@/components/StandaloneAppShell";
import {
  FOOTBALL_LEAGUES,
  NATIONAL_TEAM_ID,
  currentFootballSeason,
  footballApiUrl,
  footballMatchesPath,
  footballTablePath,
  formatKickOff,
  isLiveStatus,
  matchStatusLabel,
  nationalApiUrl,
  parseFootballMatches,
  parseFootballTable,
  parseNationalEvents,
  parseSportsDbTable,
  sportsDbLeagueEventsPath,
  sportsDbLeagueResultsPath,
  sportsDbSeason,
  sportsDbTablePath,
  type FootballLeague,
  type FootballMatch,
  type FootballTableRow,
} from "@/lib/football";
import { loadFavoriteTeams, toggleFavoriteTeam } from "@/lib/favorite-teams";

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

function isLiveMatch(match: FootballMatch): boolean {
  return !match.finished && isLiveStatus(match.status);
}

function TeamStarButton({
  team,
  favorites,
  onToggleFavorite,
}: {
  team: string;
  favorites: string[];
  onToggleFavorite: (team: string) => void;
}) {
  const active = favorites.includes(team);
  return (
    <button
      type="button"
      onClick={() => onToggleFavorite(team)}
      aria-pressed={active}
      aria-label={
        active ? `${team} aus Lieblingsteams entfernen` : `${team} als Lieblingsteam merken`
      }
      className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:text-amber-400"
    >
      <Star
        className={`h-4 w-4 ${active ? "fill-amber-400 text-amber-400" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}

function MatchCard({
  match,
  favorites,
  onToggleFavorite,
}: {
  match: FootballMatch;
  favorites: string[];
  onToggleFavorite: (team: string) => void;
}) {
  const live = isLiveMatch(match);
  const showScore = match.finished || live;
  return (
    <article
      className={`rounded-2xl border p-4 ${
        live ? "border-emerald-400/50 bg-emerald-400/10" : "border-border/70 bg-card/70"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{formatKickOff(match.kickOffUtc)}</p>
        {match.status && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              live ? "bg-emerald-400/20 text-emerald-300" : "bg-primary/10 text-muted-foreground"
            }`}
          >
            {matchStatusLabel(match.status)}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <TeamStarButton
          team={match.home}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
        />
        <p className="min-w-0 flex-1 truncate font-semibold">{match.home}</p>
        {showScore && (
          <span className="shrink-0 font-bold">
            {match.homeGoals ?? "–"} : {match.awayGoals ?? "–"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TeamStarButton
          team={match.away}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
        />
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">vs. {match.away}</p>
      </div>
      {(match.round || match.venue) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {[match.round ? `Spieltag ${match.round}` : null, match.venue]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </article>
  );
}

function SportsPage() {
  const season = currentFootballSeason();
  const dbSeason = sportsDbSeason();
  const [leagueId, setLeagueId] = useState("bl1");
  const [table, setTable] = useState<FootballTableRow[]>([]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const league = FOOTBALL_LEAGUES.find((entry) => entry.id === leagueId) ?? FOOTBALL_LEAGUES[0];

  useEffect(() => {
    setFavorites(loadFavoriteTeams());
  }, []);

  const toggleFavorite = useCallback((team: string) => {
    setFavorites((current) => toggleFavoriteTeam(current, team));
  }, []);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const activeLeague =
      FOOTBALL_LEAGUES.find((entry) => entry.id === leagueId) ?? FOOTBALL_LEAGUES[0];
    const isNational = activeLeague.id === "deutschland";
    const isSportsDbLeague = activeLeague.source === "sportsdb" && !isNational;
    const fetchJson = (url: string) =>
      fetch(url)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
    const requests: [Promise<unknown>, Promise<unknown>] = [
      !activeLeague.hasTable
        ? Promise.resolve(null)
        : isSportsDbLeague
          ? fetchJson(nationalApiUrl(sportsDbTablePath(activeLeague.sportsDbId ?? "", dbSeason)))
          : fetchJson(footballApiUrl(footballTablePath(leagueId, season))),
      isNational
        ? Promise.all([
            fetchJson(nationalApiUrl(`eventsnext.php?id=${NATIONAL_TEAM_ID}`)),
            fetchJson(nationalApiUrl(`eventslast.php?id=${NATIONAL_TEAM_ID}`)),
          ]).then(([nextValue, lastValue]) => [
            ...parseNationalEvents(nextValue),
            ...parseNationalEvents(lastValue),
          ])
        : isSportsDbLeague
          ? Promise.all([
              fetchJson(nationalApiUrl(sportsDbLeagueEventsPath(activeLeague.sportsDbId ?? ""))),
              fetchJson(nationalApiUrl(sportsDbLeagueResultsPath(activeLeague.sportsDbId ?? ""))),
            ]).then(([nextValue, lastValue]) => [
              ...parseNationalEvents(nextValue),
              ...parseNationalEvents(lastValue),
            ])
          : fetchJson(footballApiUrl(footballMatchesPath(leagueId, season))),
    ];
    void Promise.all(requests).then(([tableValue, matchValue]) => {
      if (!active) return;
      const parsedTable = isSportsDbLeague
        ? parseSportsDbTable(tableValue)
        : parseFootballTable(tableValue);
      const parsedMatches = Array.isArray(matchValue)
        ? (matchValue as FootballMatch[])
        : parseFootballMatches(matchValue);
      setTable(parsedTable);
      setMatches(parsedMatches);
      if (parsedMatches.length === 0 && (!activeLeague.hasTable || parsedTable.length === 0)) {
        setError(
          activeLeague.source === "openligadb"
            ? "Die Bundesliga-Daten sind gerade nicht erreichbar. Bitte versuche es später erneut."
            : `Für ${activeLeague.name} sind aktuell keine Spiele in TheSportsDB eingetragen.`,
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [season, dbSeason, leagueId, reloadKey]);

  const matchday = latestMatchday(matches);
  const matchdayLabel =
    matches.find((match) => match.groupOrder === matchday)?.groupName ||
    (matchday > 0 && league.id !== "deutschland" ? `${matchday}. Spieltag` : "");
  const liveMatches = matches.filter(isLiveMatch);
  const liveMatch = liveMatches[0] ?? null;
  const highlight = liveMatch ?? lastFinishedMatch(matches, matchday);
  const upcoming = nextMatches(matches, matchday);
  const matchdayMatches = matches.filter((match) => match.groupOrder === matchday);
  const finishedCount = matchdayMatches.filter((match) => match.finished).length;
  const goalsCount = matchdayMatches.reduce(
    (sum, match) => sum + (match.homeGoals ?? 0) + (match.awayGoals ?? 0),
    0,
  );
  const favoriteMatches = matches.filter(
    (match) => favorites.includes(match.home) || favorites.includes(match.away),
  );

  return (
    <StandaloneAppShell>
      <HomeAppMenuLayout
        eyebrow="ALO SPORTS · FUSSBALL"
        title="Spiele & Live"
        sidebar={
          <div className="flex flex-col gap-2">
            <Link
              to="/football"
              className="mt-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:underline"
            >
              Alo Fußball öffnen
            </Link>
          </div>
        }
        description={`${league.name} der Saison ${season}/${String(season + 1).slice(2)} — ${league.source === "openligadb" ? "live von OpenLigaDB" : "live von TheSportsDB"}.`}
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
                      {highlight.homeGoals ?? "–"} : {highlight.awayGoals ?? "–"}
                    </span>{" "}
                    {highlight.away}
                  </h2>
                  <p className="mt-2 text-xs uppercase tracking-wide text-emerald-300">
                    {liveMatch
                      ? `Live · ${matchStatusLabel(liveMatch.status)}`
                      : "Beendet · Letztes Ergebnis"}
                  </p>
                </>
              ) : (
                <h2 id="matchday-title" className="mt-5 text-xl font-bold sm:text-2xl">
                  Am ausgewählten Spieltag wurde noch kein Spiel beendet.
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

            <section aria-labelledby="live-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="live-title" className="text-lg font-bold">
                  Live & Aktuell
                </h2>
                <button
                  type="button"
                  onClick={refresh}
                  aria-label="Daten aktualisieren"
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  <Activity className="h-3.5 w-3.5" /> Aktualisieren
                </button>
              </div>
              {liveMatches.length === 0 ? (
                <p className="rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
                  Gerade kein Live-Spiel in den geladenen Daten. Der Status wird beim Aktualisieren
                  neu geladen; laufende Spielminuten bietet die Quelle nicht an.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {liveMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
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
                    <MatchCard
                      key={match.id}
                      match={match}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </section>

            {league.hasTable && (
              <div className="grid gap-4">
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
                        <div key={row.name} className="flex items-center gap-2">
                          <span className="w-5 text-muted-foreground">{row.position}</span>
                          <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                          <TeamStarButton
                            team={row.name}
                            favorites={favorites}
                            onToggleFavorite={toggleFavorite}
                          />
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
              </div>
            )}

            <section
              aria-labelledby="favorites-title"
              className="rounded-2xl border border-border/70 bg-card/70 p-5"
            >
              <div className="flex items-center justify-between">
                <h2 id="favorites-title" className="font-bold">
                  Lieblingsteams
                </h2>
                <Star className="h-5 w-5 text-amber-400" aria-hidden="true" />
              </div>
              {favorites.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Noch keine Lieblingsteams gewählt. Tippe in der Tabelle oder in einem Spiel auf
                  den Stern, um ein Team zu merken.
                </p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {favorites.map((team) => (
                      <span
                        key={team}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
                      >
                        {team}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(team)}
                          aria-label={`${team} aus Lieblingsteams entfernen`}
                          className="text-muted-foreground transition hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {favoriteMatches.length > 0
                      ? `Spiele deiner Lieblingsteams in ${league.name}:`
                      : `Keine Spiele deiner Lieblingsteams in den geladenen Daten von ${league.name}.`}
                  </p>
                  <div className="mt-3 space-y-2">
                    {favoriteMatches.slice(0, 5).map((match) => (
                      <div
                        key={`favorite-${match.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {match.home} vs. {match.away}
                        </span>
                        <span className="shrink-0 font-semibold">
                          {match.finished || isLiveMatch(match)
                            ? `${match.homeGoals ?? "–"} : ${match.awayGoals ?? "–"}`
                            : formatKickOff(match.kickOffUtc)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Diese Seite zeigt echte Fußball-Daten von OpenLigaDB und TheSportsDB. Der Live-Status und
          die Spielstände werden beim Aktualisieren neu geladen; laufende Spielminuten oder
          Zwischenstände während laufender Spiele bieten die Quellen nicht an; angezeigt werden
          Ergebnisse beendeter Spiele und die aktuellen Ansetzungen. Lieblingsteams werden nur lokal
          auf deinem Gerät gespeichert.
        </p>
        <Link to="/marketplace" className="text-sm font-semibold text-primary hover:underline">
          Zurück zum Marketplace
        </Link>
      </HomeAppMenuLayout>
    </StandaloneAppShell>
  );
}

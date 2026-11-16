import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import {
  currentFootballSeason,
  footballApiUrl,
  formatKickOff,
  parseFootballMatches,
  parseFootballTable,
  type FootballMatch,
  type FootballTableRow,
} from "@/lib/football";

export const Route = createFileRoute("/football")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Alo Fußball — Bundesliga" },
      {
        name: "description",
        content: "Bundesliga-Spieltage mit Ergebnissen und Ansetzungen sowie die aktuelle Tabelle.",
      },
    ],
  }),
  component: FootballPage,
});

const FIRST_MATCHDAY = 1;
const LAST_MATCHDAY = 34;

function FootballPage() {
  const season = currentFootballSeason();
  const [groupOrder, setGroupOrder] = useState<number | null>(null);
  const [table, setTable] = useState<FootballTableRow[]>([]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const matchesPath =
      groupOrder === null
        ? `getmatchdata/bl1/${season}`
        : `getmatchdata/bl1/${season}/${groupOrder}`;
    const requests = [
      fetch(footballApiUrl(`getbltable/bl1/${season}`))
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch(footballApiUrl(matchesPath))
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ];
    void Promise.all(requests).then(([tableValue, matchValue]) => {
      if (!active) return;
      const parsedTable = parseFootballTable(tableValue);
      const parsedMatches = parseFootballMatches(matchValue);
      setTable(parsedTable);
      setMatches(parsedMatches);
      if (parsedTable.length === 0 && parsedMatches.length === 0) {
        setError(
          "Die Bundesliga-Daten sind gerade nicht erreichbar. Bitte versuche es später erneut.",
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [season, groupOrder]);

  const activeGroup = groupOrder ?? matches[0]?.groupOrder ?? null;
  const matchdayLabel = matches[0]?.groupName || (activeGroup ? `${activeGroup}. Spieltag` : "");
  const stepMatchday = (delta: number) => {
    const base = activeGroup ?? FIRST_MATCHDAY;
    const next = Math.min(LAST_MATCHDAY, Math.max(FIRST_MATCHDAY, base + delta));
    if (next !== base) setGroupOrder(next);
  };

  return (
    <HomeAppMenuLayout
      eyebrow="ALO FUSSBALL · BUNDESLIGA"
      title="Fußball"
      description={`Spieltage und Tabelle der Saison ${season}/${String(season + 1).slice(2)} — live von OpenLigaDB.`}
    >
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {loading && (
        <p className="text-sm text-muted-foreground">Bundesliga-Daten werden geladen …</p>
      )}

      <section aria-labelledby="matchday-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="matchday-title" className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="h-5 w-5 text-primary" />
            {matchdayLabel || "Spieltag"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Vorheriger Spieltag"
              disabled={activeGroup === null || activeGroup <= FIRST_MATCHDAY}
              onClick={() => stepMatchday(-1)}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-primary/50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Nächster Spieltag"
              disabled={activeGroup === null || activeGroup >= LAST_MATCHDAY}
              onClick={() => stepMatchday(1)}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-primary/50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((match) => (
            <article key={match.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{formatKickOff(match.kickOffUtc)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    match.finished
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {match.finished ? "Beendet" : "Angesetzt"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{match.home}</p>
                <p className="shrink-0 text-lg font-bold tabular-nums">
                  {match.finished ? `${match.homeGoals} : ${match.awayGoals}` : "– : –"}
                </p>
                <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold">
                  {match.away}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-2xl border border-border/70 bg-card/70"
        aria-labelledby="football-table-title"
      >
        <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
          <h2 id="football-table-title" className="flex items-center gap-2 font-bold">
            <Trophy className="h-5 w-5 text-amber-400" />
            Tabelle
          </h2>
          <span className="text-xs text-muted-foreground">Saison {season}</span>
        </div>
        <div className="overflow-x-auto px-2 pb-3 pt-2">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-2 py-2 font-semibold">
                  Pos
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Verein
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Sp
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  G
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  U
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  V
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Tore
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Punkte
                </th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.name} className="border-t border-border/50">
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{row.position}</td>
                  <td className="px-2 py-2 font-medium">{row.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.matches}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.won}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.draw}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.lost}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {row.goals}:{row.opponentGoals}
                  </td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {table.length === 0 && !loading && (
            <p className="px-3 pb-3 text-sm text-muted-foreground">
              Keine Tabellendaten verfügbar.
            </p>
          )}
        </div>
      </section>
    </HomeAppMenuLayout>
  );
}

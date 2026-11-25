export type FootballTableRow = {
  position: number;
  name: string;
  matches: number;
  won: number;
  draw: number;
  lost: number;
  goals: number;
  opponentGoals: number;
  points: number;
};

export type FootballMatch = {
  id: number | string;
  home: string;
  away: string;
  kickOffUtc: string | null;
  finished: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  groupName: string;
  groupOrder: number;
  status?: string | null;
  venue?: string | null;
  round?: string | null;
};

export function selectFootballMatchdayMatches(
  matches: FootballMatch[],
  groupOrder: number | null,
): FootballMatch[] {
  return groupOrder === null ? matches : matches.filter((match) => match.groupOrder === groupOrder);
}

const OPENLIGADB_BASE = "https://api.openligadb.de";
const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123";

export const NATIONAL_TEAM_ID = "133907";

export function footballApiUrl(path: string): string {
  return `${OPENLIGADB_BASE}/${path.replace(/^\/+/, "")}`;
}

export function nationalApiUrl(path: string): string {
  return `${SPORTSDB_BASE}/${path.replace(/^\/+/, "")}`;
}

export function currentFootballSeason(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

export type FootballLeague = {
  id: string;
  name: string;
  hasTable: boolean;
  source: "openligadb" | "sportsdb";
  sportsDbId?: string;
};

export const FOOTBALL_LEAGUES: FootballLeague[] = [
  { id: "bl1", name: "Bundesliga", hasTable: true, source: "openligadb" },
  { id: "bl2", name: "2. Bundesliga", hasTable: true, source: "openligadb" },
  { id: "bl3", name: "3. Liga", hasTable: true, source: "openligadb" },
  {
    id: "premier",
    name: "Premier League",
    hasTable: true,
    source: "sportsdb",
    sportsDbId: "4328",
  },
  { id: "laliga", name: "La Liga", hasTable: true, source: "sportsdb", sportsDbId: "4335" },
  { id: "seriea", name: "Serie A", hasTable: true, source: "sportsdb", sportsDbId: "4332" },
  { id: "ligue1", name: "Ligue 1", hasTable: true, source: "sportsdb", sportsDbId: "4334" },
  { id: "deutschland", name: "Nationalmannschaft", hasTable: false, source: "sportsdb" },
];

export function footballMatchesPath(leagueId: string, season: number): string {
  return leagueId === "deutschland"
    ? "getmatchdata/deutschland"
    : `getmatchdata/${leagueId}/${season}`;
}

export function footballTablePath(leagueId: string, season: number): string {
  return `getbltable/${leagueId}/${season}`;
}

export function sportsDbSeason(now = new Date()): string {
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

export function sportsDbLeagueEventsPath(sportsDbId: string): string {
  return `eventsnextleague.php?id=${sportsDbId}`;
}

export function sportsDbLeagueResultsPath(sportsDbId: string): string {
  return `eventspastleague.php?id=${sportsDbId}`;
}

export function sportsDbTablePath(sportsDbId: string, season: string): string {
  return `lookuptable.php?l=${sportsDbId}&s=${season}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function numericOf(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function goalsOf(entry: Record<string, unknown>): { home: number; away: number } | null {
  const results = Array.isArray(entry.matchResults) ? entry.matchResults : [];
  if (results.length === 0) return null;
  const chosen =
    results.find((candidate) => asRecord(candidate).resultTypeID === 2) ??
    results[results.length - 1];
  const result = asRecord(chosen);
  const home = numberOf(result.pointsTeam1);
  const away = numberOf(result.pointsTeam2);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

export function parseFootballTable(value: unknown): FootballTableRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const entry = asRecord(raw);
      return {
        position: 0,
        name: typeof entry.teamName === "string" ? entry.teamName : "",
        matches: numberOf(entry.matches),
        won: numberOf(entry.won),
        draw: numberOf(entry.draw),
        lost: numberOf(entry.lost),
        goals: numberOf(entry.goals),
        opponentGoals: numberOf(entry.opponentGoals),
        points: numberOf(entry.points),
      };
    })
    .filter((row) => row.name.trim().length > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goals - b.opponentGoals - (a.goals - a.opponentGoals) ||
        b.goals - a.goals ||
        a.name.localeCompare(b.name),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function parseFootballMatches(value: unknown): FootballMatch[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((raw) => {
      const entry = asRecord(raw);
      const home = asRecord(entry.team1);
      const away = asRecord(entry.team2);
      const homeName = typeof home.teamName === "string" ? home.teamName : "";
      const awayName = typeof away.teamName === "string" ? away.teamName : "";
      if (!homeName || !awayName) return [];
      const group = asRecord(entry.group);
      const result = goalsOf(entry);
      const kickOffUtc =
        typeof entry.matchDateTimeUTC === "string"
          ? entry.matchDateTimeUTC
          : typeof entry.matchDateTime === "string"
            ? entry.matchDateTime
            : null;
      return [
        {
          id: typeof entry.matchID === "number" ? entry.matchID : `${homeName}-${awayName}`,
          home: homeName,
          away: awayName,
          kickOffUtc,
          finished: entry.matchIsFinished === true,
          homeGoals: result?.home ?? null,
          awayGoals: result?.away ?? null,
          groupName: typeof group.groupName === "string" ? group.groupName : "",
          groupOrder: numberOf(group.groupOrderID),
          status: null,
          venue: null,
          round: null,
        },
      ];
    })
    .sort((a, b) => {
      const aTime = a.kickOffUtc ? new Date(a.kickOffUtc).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.kickOffUtc ? new Date(b.kickOffUtc).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}

function scoreOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseNationalEvents(value: unknown): FootballMatch[] {
  const container = asRecord(value);
  const events = Array.isArray(container.events) ? container.events : [];
  return events
    .map((raw): FootballMatch | null => {
      const entry = asRecord(raw);
      const home = typeof entry.strHomeTeam === "string" ? entry.strHomeTeam : "";
      const away = typeof entry.strAwayTeam === "string" ? entry.strAwayTeam : "";
      if (!home || !away) return null;
      const status = typeof entry.strStatus === "string" ? entry.strStatus : "";
      const timestamp =
        typeof entry.strTimestamp === "string" && entry.strTimestamp.trim().length > 0
          ? entry.strTimestamp
          : null;
      return {
        id:
          typeof entry.idEvent === "string" || typeof entry.idEvent === "number"
            ? entry.idEvent
            : `${home}-${away}`,
        home,
        away,
        kickOffUtc: timestamp ? `${timestamp}Z` : null,
        finished: status === "FT" || status === "Match Finished",
        homeGoals: scoreOf(entry.intHomeScore),
        awayGoals: scoreOf(entry.intAwayScore),
        groupName: typeof entry.strLeague === "string" ? entry.strLeague : "",
        groupOrder: 0,
        status: status || null,
        venue:
          typeof entry.strVenue === "string" && entry.strVenue.trim().length > 0
            ? entry.strVenue
            : null,
        round:
          typeof entry.intRound === "string" && entry.intRound.trim().length > 0
            ? entry.intRound
            : null,
      } satisfies FootballMatch;
    })
    .filter((match): match is FootballMatch => match !== null)
    .sort((a, b) => {
      const aTime = a.kickOffUtc ? new Date(a.kickOffUtc).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.kickOffUtc ? new Date(b.kickOffUtc).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}

export function parseSportsDbTable(value: unknown): FootballTableRow[] {
  const container = asRecord(value);
  const table = Array.isArray(container.table) ? container.table : [];
  return table
    .map((raw) => {
      const entry = asRecord(raw);
      return {
        position: numericOf(entry.intRank),
        name: typeof entry.strTeam === "string" ? entry.strTeam : "",
        matches: numericOf(entry.intPlayed),
        won: numericOf(entry.intWin),
        draw: numericOf(entry.intDraw),
        lost: numericOf(entry.intLoss),
        goals: numericOf(entry.intGoalsFor),
        opponentGoals: numericOf(entry.intGoalsAgainst),
        points: numericOf(entry.intPoints),
      };
    })
    .filter((row) => row.name.trim().length > 0)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, position: index + 1 }));
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "Match Finished"]);
const SCHEDULED_STATUSES = new Set([
  "NS",
  "",
  "Postponed",
  "Cancelled",
  "Canceled",
  "Time To Be Defined",
]);

export function isLiveStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return !FINISHED_STATUSES.has(status) && !SCHEDULED_STATUSES.has(status);
}

export function matchStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "NS":
      return "Angesetzt";
    case "1H":
      return "1. Halbzeit";
    case "HT":
      return "Halbzeitpause";
    case "2H":
      return "2. Halbzeit";
    case "ET":
      return "Verlängerung";
    case "P":
      return "Elfmeterschießen";
    case "AET":
      return "Nach Verlängerung";
    case "PEN":
      return "Nach Elfmeterschießen";
    case "FT":
    case "Match Finished":
      return "Beendet";
    case "Postponed":
      return "Verschoben";
    case "Cancelled":
    case "Canceled":
      return "Abgesagt";
    case "Suspended":
      return "Unterbrochen";
    default:
      return status || "Angesetzt";
  }
}

export function formatKickOff(kickOffUtc: string | null): string {
  if (!kickOffUtc) return "Termin offen";
  const date = new Date(kickOffUtc);
  if (Number.isNaN(date.getTime())) return "Termin offen";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

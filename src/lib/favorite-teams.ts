const FAVORITE_TEAMS_STORAGE_KEY = "alo-favorite-teams";
const MAX_FAVORITE_TEAMS = 20;

export function loadFavoriteTeams(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITE_TEAMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter((team): team is string => typeof team === "string" && team.trim().length > 0),
      ),
    ]
      .map((team) => team.trim())
      .slice(0, MAX_FAVORITE_TEAMS);
  } catch {
    return [];
  }
}

export function saveFavoriteTeams(teams: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITE_TEAMS_STORAGE_KEY, JSON.stringify(teams));
  } catch {
    return;
  }
}

export function toggleFavoriteTeam(teams: string[], name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return teams;
  const next = teams.includes(trimmed)
    ? teams.filter((team) => team !== trimmed)
    : [...teams, trimmed].slice(0, MAX_FAVORITE_TEAMS);
  saveFavoriteTeams(next);
  return next;
}

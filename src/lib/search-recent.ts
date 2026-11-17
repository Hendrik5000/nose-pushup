import { scopedStorageKey } from "@/integrations/supabase/backendScope";

export const SEARCH_RECENT_MAX = 8;
const MAX_QUERY_LENGTH = 120;
const MAX_STORED_BYTES = 2_048;

export function searchRecentStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Alo-Konto ist erforderlich.");
  return scopedStorageKey("alo-search-recent-v1", userId);
}

export function loadRecentSearches(storage: Pick<Storage, "getItem">, userId: string): string[] {
  try {
    const raw = storage.getItem(searchRecentStorageKey(userId));
    if (!raw || raw.length > MAX_STORED_BYTES) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const recent: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim().slice(0, MAX_QUERY_LENGTH);
      if (trimmed && !recent.includes(trimmed)) recent.push(trimmed);
      if (recent.length >= SEARCH_RECENT_MAX) break;
    }
    return recent;
  } catch {
    return [];
  }
}

export function rememberSearch(
  storage: Pick<Storage, "getItem" | "setItem">,
  userId: string,
  query: string,
): string[] {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return loadRecentSearches(storage, userId);
  const next = [
    trimmed,
    ...loadRecentSearches(storage, userId).filter((entry) => entry !== trimmed),
  ].slice(0, SEARCH_RECENT_MAX);
  try {
    storage.setItem(searchRecentStorageKey(userId), JSON.stringify(next));
  } catch {
    /* suggestions stay session-only */
  }
  return next;
}

export function forgetRecentSearches(storage: Pick<Storage, "removeItem">, userId: string): void {
  try {
    storage.removeItem(searchRecentStorageKey(userId));
  } catch {
    /* nothing to forget */
  }
}

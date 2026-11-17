import { scopedStorageKey } from "@/integrations/supabase/backendScope";

export const HOME_RECENT_APPS_MAX = 8;
const MAX_STORED_BYTES = 2_048;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export function homeRecentAppsStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Alo-Konto ist erforderlich.");
  return scopedStorageKey("alo-home-recent-apps-v1", userId);
}

type HomeRecentAppEntry = { id: string; at: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntries(value: unknown, now: number): HomeRecentAppEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: HomeRecentAppEntry[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    const id = item.id.trim();
    if (!id) continue;
    const at = typeof item.at === "number" && Number.isFinite(item.at) ? item.at : 0;
    if (at <= 0 || now - at > MAX_AGE_MS || at > now + 60_000) continue;
    if (!entries.some((entry) => entry.id === id)) entries.push({ id, at });
  }
  return entries.sort((a, b) => b.at - a.at);
}

export function loadRecentHomeAppIds(
  storage: Pick<Storage, "getItem">,
  userId: string,
  now = Date.now(),
): string[] {
  try {
    const raw = storage.getItem(homeRecentAppsStorageKey(userId));
    if (!raw || raw.length > MAX_STORED_BYTES) return [];
    return parseEntries(JSON.parse(raw) as unknown, now)
      .slice(0, HOME_RECENT_APPS_MAX)
      .map((entry) => entry.id);
  } catch {
    return [];
  }
}

export function rememberHomeAppOpen(
  storage: Pick<Storage, "getItem" | "setItem">,
  userId: string,
  appId: string,
  now = Date.now(),
): string[] {
  const id = appId.trim();
  if (!id) return loadRecentHomeAppIds(storage, userId, now);
  let previous: HomeRecentAppEntry[] = [];
  try {
    const raw = storage.getItem(homeRecentAppsStorageKey(userId));
    if (raw && raw.length <= MAX_STORED_BYTES) {
      previous = parseEntries(JSON.parse(raw) as unknown, now);
    }
  } catch {
    previous = [];
  }
  const next = [{ id, at: now }, ...previous.filter((entry) => entry.id !== id)].slice(
    0,
    HOME_RECENT_APPS_MAX,
  );
  try {
    storage.setItem(homeRecentAppsStorageKey(userId), JSON.stringify(next));
  } catch {
    /* recent list stays session-only */
  }
  return next.map((entry) => entry.id);
}

export function forgetRecentHomeApps(storage: Pick<Storage, "removeItem">, userId: string): void {
  try {
    storage.removeItem(homeRecentAppsStorageKey(userId));
  } catch {
    /* nothing to forget */
  }
}

export function homeDayGreeting(hour: number): string {
  if (!Number.isFinite(hour)) return "Guten Tag";
  const normalized = ((Math.round(hour) % 24) + 24) % 24;
  if (normalized < 5) return "Gute Nacht";
  if (normalized < 11) return "Guten Morgen";
  if (normalized < 18) return "Guten Tag";
  return "Guten Abend";
}

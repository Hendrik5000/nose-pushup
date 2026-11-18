/**
 * Kleiner TTL-Lese-Cache ffür Startseiten-Daten, die von mehreren Hooks gelesen
 * werden (Profile, Tagesstatistik): Dedupliziert parallele Anfragen beim Start und
 * kurzzeitige Wiederholungen. NUR ffür unkritische Lesezugriffe ohne personenbezogene
 * Erlöschungspflicht in dieser kurzen Zeitspanne; die Kurzwiedergabe passiert
 * ausschließlich im Speicher des Ger\u00e4ts.
 */

export const HOME_DATA_CACHE_TTL_MS = 30_000;

type CacheEntry = { value: unknown; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cachedRead<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = loader()
    .then((value) => {
      cache.set(key, { value, expiresAt: now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export function resetCachedReadsForTests() {
  cache.clear();
  inflight.clear();
}

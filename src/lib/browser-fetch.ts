/**
 * Gemeinsame Netzwerkschicht des Alo-Browsers: alle Proxy-/Reader-Quellen werden
 * parallel geraced (die erste brauchbare Antwort gewinnt) statt nacheinander
 * abgewartet, mit Abort-Timeout, damit ein hängender Dienst die Seite nicht blockiert.
 * Ergebnisse werden kurz im Speicher gecacht, sodass Zurück/Vorwärts und erneute
 * Besuche sofort erscheinen.
 */

export type BrowserFetch = (input: string, init?: RequestInit) => Promise<Response>;

const injected: { fetchImpl?: BrowserFetch } = {};

export function setBrowserFetchForTests(impl?: BrowserFetch) {
  injected.fetchImpl = impl;
}

function impl(): BrowserFetch {
  return injected.fetchImpl ?? ((input, init) => fetch(input, init));
}

export const BROWSER_FETCH_TIMEOUT_MS = 12_000;
export const BROWSER_CACHE_TTL_MS = 10 * 60 * 1000;

export function browserProxyUrls(targetUrl: string): string[] {
  return [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
  ];
}

export function browserReaderUrl(targetUrl: string): string {
  return `https://r.jina.ai/${targetUrl}`;
}

/**
 * Erkennt JS-Shell-Seiten (Single-Page-Apps): viele Script-Tags, kaum sichtbarer
 * Text, typische Mount-Punkte wie id="root". Diese Seiten zeigen im iframe nur
 * Weiß — sie gehören direkt in den Reader-Modus.
 */
export function looksLikeJsShell(html: string): boolean {
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  if (scriptCount < 3) return false;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length >= 200) return false;
  return /id\s*=\s*["']?(root|app|__next|__nuxt|mount)["']?/i.test(html) || text.length < 80;
}

const cache = new Map<string, { at: number; html: string; reader: string }>();

export function readCachedBrowserPage(
  targetUrl: string,
): { html: string; reader: string } | undefined {
  const hit = cache.get(targetUrl);
  if (!hit) return undefined;
  if (Date.now() - hit.at > BROWSER_CACHE_TTL_MS) {
    cache.delete(targetUrl);
    return undefined;
  }
  return { html: hit.html, reader: hit.reader };
}

export function cacheBrowserPage(targetUrl: string, html: string, reader: string) {
  cache.set(targetUrl, { at: Date.now(), html, reader });
}

export function clearBrowserPageCacheForTests() {
  cache.clear();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await impl()(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Startet alle URLs gleichzeitig und nimmt die erste Antwort, die ok ist und
 * mindestens `minLength` Zeichen enthält. Rejektionen (auch Timeouts) warten nicht
 * aufeinander; schlagen alle fehl, wird der letzte Fehler geworfen.
 */
export async function fetchFirstUsable(
  urls: string[],
  options: { timeoutMs?: number; minLength?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  const { timeoutMs = BROWSER_FETCH_TIMEOUT_MS, minLength = 1, headers } = options;
  if (urls.length === 0) throw new Error("Keine Quellen angegeben.");

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let failures = 0;
    let lastError: unknown = new Error("Keine Quelle antwortete.");

    urls.forEach((url) => {
      fetchWithTimeout(url, timeoutMs)
        .then(async (res) => {
          if (settled) return;
          if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
          const text = (await res.text()).trim();
          if (settled) return;
          if (text.length < minLength) throw new Error(`Zu kurz von ${url}`);
          settled = true;
          resolve(text);
        })
        .catch((error) => {
          if (settled) return;
          failures += 1;
          lastError = error;
          if (failures === urls.length) reject(lastError);
        });
    });
  });
}

export async function fetchBrowserPage(
  targetUrl: string,
): Promise<{ html: string; reader: string }> {
  const cached = readCachedBrowserPage(targetUrl);
  if (cached) return cached;

  const [html, reader] = await Promise.allSettled([
    fetchFirstUsable(browserProxyUrls(targetUrl), { minLength: 200 }),
    fetchFirstUsable([browserReaderUrl(targetUrl)], {
      minLength: 40,
      headers: { Accept: "text/plain" },
    }),
  ]);

  const htmlText = html.status === "fulfilled" ? html.value : "";
  const readerText = reader.status === "fulfilled" ? reader.value : "";
  if (htmlText || readerText) cacheBrowserPage(targetUrl, htmlText, readerText);
  return { html: htmlText, reader: readerText };
}

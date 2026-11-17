/**
 * Serverseitiger Abruf für Mira-Browser-Use: holt echte Websites ohne CORS-Grenzen,
 * extrahiert Titel, Text, klickbare Links und GET-Suchformulare. Mira kann damit
 * fremde Seiten lesen und bedienen (Links folgen, site-interne Suche).
 * Schutz: nur http/https, private Adressbereiche blockiert (SSRF), Größen- und
 * Zeitlimits. Kein Headless-Browser — Interaktion passiert auf HTTP-Ebene.
 */

export interface BrowserAgentLink {
  href: string;
  text: string;
}

export interface BrowserAgentForm {
  action: string;
  fieldName: string;
}

export interface BrowserAgentPage {
  url: string;
  title: string;
  text: string;
  links: BrowserAgentLink[];
  forms: BrowserAgentForm[];
  frameBlocked?: boolean;
}

const MAX_BYTES = 3_000_000;
const MAX_TEXT_CHARS = 8000;
const MAX_LINKS = 40;
const FETCH_TIMEOUT_MS = 12_000;

const injected: { fetchImpl?: typeof fetch } = {};

export function setBrowserAgentFetchForTests(impl?: typeof fetch) {
  injected.fetchImpl = impl;
}

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Ungültige Adresse.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Nur http- und https-Adressen sind erlaubt.");
  }
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    throw new Error("Diese Adresse ist nicht erlaubt.");
  }
  return url;
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function absoluteLinkHref(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractBrowserAgentPage(html: string, baseUrl: string): BrowserAgentPage {
  const title = stripHtmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const links: BrowserAgentLink[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*href=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) && links.length < MAX_LINKS) {
    const href = absoluteLinkHref(match[1] ?? match[2] ?? match[3] ?? "", baseUrl);
    const text = stripHtmlToText(match[4] ?? "").slice(0, 120);
    if (!href || !text || seen.has(href)) continue;
    seen.add(href);
    links.push({ href, text });
  }

  const forms: BrowserAgentForm[] = [];
  const formPattern = /<form\b[^>]*>/gi;
  while ((match = formPattern.exec(html)) && forms.length < 5) {
    const formTag = match[0];
    const method = formTag.match(/method\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.[1] ?? "get";
    if (method.toLowerCase() !== "get") continue;
    const rawAction = formTag.match(/action\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.[1] ?? "";
    const action = absoluteLinkHref(rawAction || baseUrl, baseUrl);
    if (!action) continue;
    const formHtml = html.slice(match.index, match.index + 4000);
    const fieldNames = Array.from(formHtml.matchAll(/<input\b[^>]*>/gi))
      .map((tag) => tag[0])
      .filter(
        (tag) =>
          /type\s*=\s*(?:"([^"]*)"|'([^']*)')/i.test(tag) === false || /text|search/i.test(tag),
      )
      .map((tag) => tag.match(/name\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.[1])
      .filter((name): name is string => Boolean(name));
    const fieldName = fieldNames[0];
    if (fieldName) forms.push({ action, fieldName });
  }

  return {
    url: baseUrl,
    title,
    text: stripHtmlToText(html).slice(0, MAX_TEXT_CHARS),
    links,
    forms,
  };
}

export function buildFormSearchUrl(form: BrowserAgentForm, query: string): string {
  const url = new URL(form.action);
  url.searchParams.set(form.fieldName, query);
  return url.toString();
}

export function responseBlocksFraming(headers: Headers): boolean {
  const xfo = (headers.get("x-frame-options") ?? "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return true;
  const csp = (headers.get("content-security-policy") ?? "").toLowerCase();
  const ancestors = csp.match(/frame-ancestors([^;]*)/);
  if (ancestors) return !ancestors[1].trim().includes("*");
  return false;
}

export async function fetchBrowserAgentPage(rawUrl: string): Promise<BrowserAgentPage> {
  const url = assertPublicHttpUrl(rawUrl);
  const doFetch = injected.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await doFetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AloBrowser/1.0; +https://alo-web.lovable.app)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Die Seite antwortete mit HTTP ${res.status}.`);
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new Error("Die Seite ist zu groß für den Abruf.");
    const html = new TextDecoder("utf-8").decode(buffer);
    return {
      ...extractBrowserAgentPage(html, res.url || url.toString()),
      frameBlocked: responseBlocksFraming(res.headers),
    };
  } finally {
    clearTimeout(timer);
  }
}

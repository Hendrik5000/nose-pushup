/**
 * Client-Seite von Miras Browser-Use: holt fremde Seiten über die authentifizierte
 * Server-Funktion (ohne CORS-Grenzen), findet klickbare Links und site-interne
 * Suchformulare und führt Aktionen wie „klicke auf …“ / „suche auf der Seite nach …“
 * aus. Fällt der Server-Abruf aus, nutzt Mira den öffentlichen Reader als Fallback.
 */

import type { BrowserAgentPage, BrowserAgentLink } from "./browser-agent.server";
import { buildFormSearchUrl } from "./browser-agent.server";
import { miraReadPage } from "./mira-browser";

const injected: { serve?: (url: string) => Promise<BrowserAgentPage> } = {};

export function setMiraBrowserAgentForTests(impl?: (url: string) => Promise<BrowserAgentPage>) {
  injected.serve = impl;
}

async function servePage(url: string): Promise<BrowserAgentPage> {
  if (injected.serve) return injected.serve(url);
  const { fetchMiraBrowserPage } = await import("./browser-agent.functions");
  return fetchMiraBrowserPage({ data: { url } });
}

export async function miraServePage(url: string): Promise<BrowserAgentPage | null> {
  try {
    return await servePage(url);
  } catch {
    return null;
  }
}

export async function miraServePageText(url: string): Promise<string> {
  const page = await miraServePage(url);
  if (page?.text && page.text.length > 40) return page.text;
  return miraReadPage(url);
}

export function findAgentLink(links: BrowserAgentLink[], target: string): BrowserAgentLink | null {
  const needle = target.trim().toLowerCase();
  if (!needle) return null;
  return (
    links.find((link) => link.text.toLowerCase() === needle) ??
    links.find((link) => link.text.toLowerCase().includes(needle)) ??
    links.find((link) => link.href.toLowerCase().includes(needle.replace(/\s+/g, "-"))) ??
    null
  );
}

export function findSiteSearchUrl(page: BrowserAgentPage, query: string): string | null {
  for (const form of page.forms) {
    try {
      return buildFormSearchUrl(form, query);
    } catch {
      /* nächstes Formular */
    }
  }
  return null;
}

export type MiraSiteActionResult =
  | { kind: "navigated"; url: string; label: string }
  | { kind: "search"; url: string; label: string }
  | { kind: "failed"; detail: string };

const CLICK_PATTERN =
  /^(?:klicke?\s+(?:auf\s+)?|öffne\s+(?:den\s+|die\s+|das\s+)?(?:link\s+)?|gehe?\s+zu\s+)(?:auf\s+)?["'„“]?([^"'„“]+)["'„“]?\s*(?:auf\s+dieser\s+seite|auf\s+der\s+seite|hier)?[.!?]*$/i;
const SITE_SEARCH_PATTERN =
  /^(?:suche|such|durchsuche|finde)\s+(?:auf\s+(?:dieser\s+|der\s+|dem\s+)?(?:seite|website)|auf\s+\S+\.(?:de|com|org|net)|im\s+(?:shop|angebot))\s*(?:nach\s+)?["'„“]?([^"'„“]+)["'„“]?[.!?]*$/i;

export async function runMiraSiteAction(
  instruction: string,
  pageUrl: string,
): Promise<MiraSiteActionResult> {
  const page = await miraServePage(pageUrl);
  if (!page) {
    return { kind: "failed", detail: `Seite konnte nicht geladen werden: ${pageUrl}` };
  }

  const searchMatch = instruction.match(SITE_SEARCH_PATTERN);
  if (searchMatch?.[1]) {
    const query = searchMatch[1].trim();
    const searchUrl = findSiteSearchUrl(page, query);
    if (searchUrl) {
      return { kind: "search", url: searchUrl, label: `Suche auf der Seite: ${query}` };
    }
    return {
      kind: "failed",
      detail: `Die Seite bietet kein Suchformular für „${query}“ an.`,
    };
  }

  const clickMatch = instruction.match(CLICK_PATTERN);
  if (clickMatch?.[1]) {
    const target = clickMatch[1].trim();
    const link = findAgentLink(page.links, target);
    if (link) {
      return { kind: "navigated", url: link.href, label: link.text || target };
    }
    return { kind: "failed", detail: `Kein Link „${target}“ auf dieser Seite gefunden.` };
  }

  return { kind: "failed", detail: "Kein bedienbarer Schritt erkannt." };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Alo-Browser (integriert aus Monicas Entwurf, Notion 15.11.2026):
 * - Komponente existiert und ist als Default exportiert
 * - Keine Secrets/Keys im Code (nur frei zugängliche Endpunkte)
 * - Webseiten laufen in einem sandboxed iframe ohne allow-same-origin
 * - Route /browser ist im authentifizierten Layout registriert
 */

const component = readFileSync(
  new URL("../src/components/browser/AloBrowser.tsx", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../src/routes/_authenticated/browser.tsx", import.meta.url),
  "utf8",
);
const routeTree = readFileSync(new URL("../src/routeTree.gen.ts", import.meta.url), "utf8");

test("Alo-Browser: Komponente existiert und exportiert AloBrowser als Default", () => {
  assert.match(component, /export default function AloBrowser/);
  assert.match(component, /type ViewMode/);
});

test("Alo-Browser: enthält keine Secrets, Keys oder Passwörter", () => {
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{16,}/,
    /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/i,
    /password\s*[:=]\s*["'][^"']+["']/i,
    /secret\s*[:=]\s*["'][^"']{8,}["']/i,
    /Bearer\s+[a-zA-Z0-9._-]{16,}/,
    /ghp_[a-zA-Z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
  ];
  for (const pattern of secretPatterns) {
    assert.equal(component.match(pattern), null);
  }
});

test("Alo-Browser: rendert Webseiten in einem sandboxed iframe ohne allow-same-origin", () => {
  assert.match(component, /sandbox="allow-scripts allow-forms allow-popups"/);
  assert.doesNotMatch(component, /sandbox="[^"]*allow-same-origin/);
});

test("Alo-Browser: führt Quick-Links und bekannte Sprachbefehle-Ziele", () => {
  assert.match(component, /QUICK_LINKS/);
  assert.match(component, /KNOWN_SITES/);
  assert.match(component, /https:\/\/www\.tagesschau\.de/);
});

test("Alo-Browser: Route /browser ist im authentifizierten Layout registriert", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/browser"\)/);
  assert.match(route, /AloBrowser/);
  assert.match(routeTree, /AuthenticatedBrowserRouteImport/);
  assert.match(routeTree, /'\/_authenticated\/browser'/);
});

test("Alo-Browser: nutzt Alo-Theme-Tokens statt fester Dunkelfarben (Apple-HIG-f\u00e4hig)", () => {
  assert.match(component, /alo-browser[^\n]*bg-background/);
  assert.match(component, /text-foreground/);
  assert.match(component, /text-muted-foreground/);
  assert.match(component, /border-border/);
  assert.match(component, /bg-primary text-primary-foreground/);
  assert.doesNotMatch(component, /bg-zinc-950/);
  assert.doesNotMatch(component, /text-zinc-400/);
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /html\[data-design-style="hig"\] \.alo-browser-tabbar/);
  assert.match(css, /html\[data-design-style="hig"\] \.alo-browser-toolbar/);
});

test("Alo-Browser: l\u00e4dt \u00fcber die parallele Proxy-Race-Schicht mit Cache", () => {
  assert.match(component, /loadBrowserPageInParallel/);
  assert.match(component, /browserProxyUrls/);
  assert.match(component, /browserReaderUrl/);
  assert.match(component, /fetchFirstUsable/);
  assert.match(component, /readCachedBrowserPage/);
  assert.match(component, /cacheBrowserPage/);
  const lib = readFileSync(new URL("../src/lib/browser-fetch.ts", import.meta.url), "utf8");
  assert.match(lib, /fetchFirstUsable/);
  assert.match(lib, /AbortController/);
  assert.match(lib, /BROWSER_FETCH_TIMEOUT_MS/);
  assert.match(lib, /cacheBrowserPage/);
});

test("Alo-Browser: zeigt HTML und Reader-Text bereits bei ihrem jeweiligen Eintreffen", () => {
  assert.match(component, /loadBrowserPageInParallel\([\s\S]*\(html\)\s*=>/);
  assert.match(component, /htmlDoc:\s*buildSafeSrcDoc\(html,\s*targetUrl\),\s*mode:\s*"web"/);
  assert.match(component, /readerText:\s*reader,\s*mode:\s*"reader"/);
  assert.match(component, /activeTab\.loading\s*&&[\s\S]*activeTab\.readerText/);
  assert.match(component, /htmlDoc:\s*"",\s*readerText:\s*""/);
});

test("Alo-Browser: blockierte Seiten bleiben \u00fcber externen Tab erreichbar", () => {
  assert.match(component, /Im neuen Tab \u00f6ffnen/);
});

test("Alo-Browser: Mira-Aktionen sind sichtbar und \u00fcbernahmen von Mira m\u00f6glich", () => {
  assert.match(component, /miraActivity/);
  assert.match(component, /Was Mira macht/);
  assert.match(component, /takeBrowserOpenUrl/);
  const miraBridge = readFileSync(new URL("../src/lib/mira-browser.ts", import.meta.url), "utf8");
  assert.match(miraBridge, /rememberBrowserOpenUrl/);
  assert.match(miraBridge, /hasWebIntent/);
  const superAi = readFileSync(
    new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(superAi, /MiraWebActivityCard/);
  assert.match(superAi, /rememberBrowserOpenUrl/);
  assert.match(superAi, /browserStepsToSystemBlock/);
});

test("Alo-Browser: blockierte und JS-leere Seiten landen automatisch im Reader-Modus (Alo 1.172)", () => {
  assert.match(component, /looksLikeJsShell/);
  assert.match(component, /miraServePage/);
  assert.match(component, /frameBlocked/);
  assert.match(component, /blockiert das Einbetten/);
  assert.match(component, /per JavaScript auf/);
  const browserFetchLib = readFileSync(
    new URL("../src/lib/browser-fetch.ts", import.meta.url),
    "utf8",
  );
  assert.match(browserFetchLib, /export function looksLikeJsShell/);
  const serverAgent = readFileSync(
    new URL("../src/lib/browser-agent.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(serverAgent, /responseBlocksFraming/);
  assert.match(serverAgent, /frameBlocked/);
});

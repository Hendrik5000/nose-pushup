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

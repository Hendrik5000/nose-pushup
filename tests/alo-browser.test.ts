import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Alo-Browser (integriert aus Monicas Entwurf, Notion 15.11.2026):
 * - Komponente existiert und ist als Default exportiert
 * - Keine Secrets/Keys im Code (nur frei zugängliche Endpunkte)
 * - Webseiten laufen in einem sandboxed iframe ohne allow-same-origin
 * - Route /browser ist im authentifizierten Layout registriert
 */

const componentPath = resolve(__dirname, "../src/components/browser/AloBrowser.tsx");
const routePath = resolve(__dirname, "../src/routes/_authenticated/browser.tsx");
const routeTreePath = resolve(__dirname, "../src/routeTree.gen.ts");

const component = readFileSync(componentPath, "utf8");
const route = readFileSync(routePath, "utf8");
const routeTree = readFileSync(routeTreePath, "utf8");

describe("Alo-Browser (Monica-Integration)", () => {
  it("Komponente existiert und exportiert AloBrowser als Default", () => {
    expect(component).toContain("export default function AloBrowser");
    expect(component).toContain("type ViewMode");
  });

  it("enthält keine Secrets, Keys oder Passwörter", () => {
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
      expect(component.match(pattern)).toBeNull();
    }
  });

  it("rendert Webseiten in einem sandboxed iframe ohne allow-same-origin", () => {
    expect(component).toContain('sandbox="allow-scripts allow-forms allow-popups"');
    expect(component).not.toContain("allow-same-origin");
  });

  it("führt Quick-Links und bekannte Sprachbefehle-Ziele", () => {
    expect(component).toContain("QUICK_LINKS");
    expect(component).toContain("KNOWN_SITES");
    expect(component).toContain("https://www.tagesschau.de");
  });

  it("Route /browser ist im authentifizierten Layout registriert", () => {
    expect(route).toContain('createFileRoute("/_authenticated/browser")');
    expect(route).toContain("AloBrowser");
    expect(routeTree).toContain("AuthenticatedBrowserRouteImport");
    expect(routeTree).toContain("'/_authenticated/browser'");
  });
});

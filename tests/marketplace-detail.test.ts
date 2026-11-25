import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the marketplace detail page shows a stylized preview strip", () => {
  const root = process.cwd();
  const catalog = readFileSync(
    resolve(root, "src/components/marketplace/MarketplaceAppCatalog.tsx"),
    "utf8",
  );
  assert.match(catalog, /Stilisierte Vorschau von \$\{selected\.name\}/);
  assert.match(catalog, /Vorschau</);
  assert.match(catalog, /bg-gradient-to-br from-primary\/25/);
  assert.match(catalog, /describeMarketplacePermissions\(selected\)/);
  assert.match(catalog, /Stilisierte Darstellung — Alo-Apps nutzen keine externen Screenshots\./);
});

test("the marketplace detail page suggests similar apps of the same category", () => {
  const root = process.cwd();
  const catalog = readFileSync(
    resolve(root, "src/components/marketplace/MarketplaceAppCatalog.tsx"),
    "utf8",
  );
  assert.match(catalog, /similarApps/);
  assert.match(catalog, /plugin\.category === selected\.category && plugin\.id !== selected\.id/);
  assert.match(catalog, /Ähnliche Apps/);
  assert.match(catalog, /similarApps\.map\(\(plugin\) => \(/);
  assert.match(catalog, /<CarouselCard key=\{plugin\.id\} plugin=\{plugin\} \/>/);
});

test("a successful list installation opens the details where separate activation is available", () => {
  const root = process.cwd();
  const catalog = readFileSync(
    resolve(root, "src/components/marketplace/MarketplaceAppCatalog.tsx"),
    "utf8",
  );
  const marketplaceRoute = readFileSync(resolve(root, "src/routes/marketplace.tsx"), "utf8");
  assert.match(catalog, /onInstall: \(pluginId: string, name: string\) => boolean/);
  assert.match(catalog, /if \(onInstall\(plugin\.id, plugin\.name\)\) setSelectedId\(plugin\.id\)/);
  assert.match(catalog, /\{enabled \? "Deaktivieren" : "Aktivieren"\}/);
  const listRowStart = catalog.indexOf("const ListRow");
  const listRowEnd = catalog.indexOf("\n\n  return (", listRowStart);
  assert.ok(listRowStart >= 0 && listRowEnd > listRowStart);
  assert.doesNotMatch(catalog.slice(listRowStart, listRowEnd), /onToggle|enabledPluginIds/);
  assert.match(marketplaceRoute, /onInstall=\{\(\) => false\}/);
  assert.match(marketplaceRoute, /return persist\(installMarketplacePlugin\(state, pluginId\)/);
});

test("the marketplace catalog displays correctly encoded German copy", () => {
  const root = process.cwd();
  const catalog = readFileSync(
    resolve(root, "src/components/marketplace/MarketplaceAppCatalog.tsx"),
    "utf8",
  );
  const expectedCopy = [
    "Details öffnen",
    "Suche zurücksetzen",
    "Keine Alo-App passt zu „{query}“. Versuche einen anderen Begriff.",
    "Deine nächsten Lieblings-Apps",
    "Vorschläge für dich",
    "App öffnen",
    "Stilisierte Vorschau von ${selected.name} — keine echten Screenshots",
    "ausführbarer Plugin-Code",
  ];
  for (const copy of expectedCopy) {
    assert.ok(catalog.includes(copy), `missing expected German copy: ${copy}`);
  }
  assert.doesNotMatch(catalog, /Ã|Â|\u00e2[\u0080-\u009f]/u);
});

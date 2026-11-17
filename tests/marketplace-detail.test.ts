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

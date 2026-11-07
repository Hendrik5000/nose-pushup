import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const miraEntry = read("components/marketplace/MarketplaceMiraAuthoring.tsx");
const miraPage = read("components/mira/SuperAiPage.tsx");
const appCatalog = read("components/marketplace/MarketplaceAppCatalog.tsx");
const customApps = read("components/marketplace/MarketplaceCustomApps.tsx");
const marketplaceRoute = read("routes/_authenticated/marketplace.tsx");
const iconRegistry = read("components/marketplace/MarketplaceIcon.tsx");

test("Mira exposes the existing app authoring tool only after server-verified admin access", () => {
  assert.match(miraPage, /<MarketplaceMiraAuthoring userId=\{userId\} \/>/);
  assert.match(miraEntry, /useServerFn\(getAdminAreaAccess\)/);
  assert.match(miraEntry, /isMarketplaceAdminAccessGranted/);
  assert.match(miraEntry, /if \(!isAdmin\) return null/);
  assert.match(miraEntry, /await checkAdminAccess\(\)/);
  assert.match(miraEntry, /<MarketplaceCustomApps userId=\{userId\} isAdmin=\{isAdmin\} \/>/);
  assert.match(miraEntry, /keine Alo-Website-Quelltexte oder beliebigen\s+Skripte/);
  assert.match(
    customApps,
    /Frühere Chats, Anhänge[\s\S]*?Gesundheits- oder Trainingsdaten werden nicht automatisch/,
  );
});

test("curated Marketplace catalog uses icon-name tiles and full-screen detail permissions/actions", () => {
  assert.match(marketplaceRoute, /<MarketplaceAppCatalog/);
  assert.match(appCatalog, /grid-cols-3[\s\S]*lg:grid-cols-6/);
  assert.match(appCatalog, /MARKETPLACE_ICON_COMPONENTS\[plugin\.icon\]/);
  assert.match(appCatalog, /onClick=\{\(\) => setSelectedId\(plugin\.id\)\}/);
  assert.match(appCatalog, /!h-\[100dvh\] !w-screen !max-w-none/);
  assert.match(appCatalog, /describeMarketplacePermissions\(selected\)/);
  assert.match(appCatalog, /Auf diesem Gerät installieren/);
  assert.match(appCatalog, /onToggle\(selected\.id, selected\.name, enabled\)/);
  assert.match(appCatalog, /onOpen\(selected\.id\)/);
});

test("published admin apps share the icon grid and a full-screen download/details flow", () => {
  assert.match(customApps, /MarketplaceIcon\s+icon=\{app\.manifest\.icon\}/);
  assert.match(customApps, /grid-cols-3[\s\S]*lg:grid-cols-6/);
  assert.match(customApps, /setSelectedAppId\(app\.appId\)/);
  assert.match(customApps, /!h-\[100dvh\] !w-screen !max-w-none/);
  assert.match(customApps, /Herunterladen & installieren/);
  assert.match(customApps, /AuthoredPermissionList manifest=\{selectedApp\.manifest\}/);
  assert.match(customApps, /Mit Mira bearbeiten/);
  assert.match(customApps, /MarketplaceManifestView/);
});

test("the icon registry covers all approved Marketplace icon IDs", () => {
  const iconList = read("lib/marketplace-authoring.ts");
  const ids = iconList.match(
    /export const MARKETPLACE_ICON_IDS[\s\S]*?Object\.freeze\(\[([\s\S]*?)\]\)/,
  )?.[1];
  assert.ok(ids);
  for (const id of ids.matchAll(/"([a-z]+)"/g)) {
    assert.match(iconRegistry, new RegExp(`\\b${id[1]}\\s*:`));
  }
});

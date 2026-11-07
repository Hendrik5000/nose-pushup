import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const miraPage = read("components/mira/SuperAiPage.tsx");
const draftPreview = read("components/marketplace/MiraMarketplaceDraftPreview.tsx");
const appCatalog = read("components/marketplace/MarketplaceAppCatalog.tsx");
const customApps = read("components/marketplace/MarketplaceCustomApps.tsx");
const appViewer = read("components/marketplace/MarketplacePublishedAppViewer.tsx");
const marketplaceRoute = read("routes/_authenticated/marketplace.tsx");
const iconRegistry = read("components/marketplace/MarketplaceIcon.tsx");
const chatIntent = read("lib/marketplace-chat-intent.ts");
const authoring = read("lib/marketplace-authoring.ts");
const manifestRenderer = read("components/marketplace/MarketplaceManifestView.tsx");

test("Alo apps are authored from ordinary Mira chat messages without a separate builder", () => {
  assert.doesNotMatch(miraPage, /MarketplaceMiraAuthoring/);
  assert.equal(
    existsSync(
      new URL("../src/components/marketplace/MarketplaceMiraAuthoring.tsx", import.meta.url),
    ),
    false,
  );
  assert.match(miraPage, /classifyMarketplaceChatIntent/);
  assert.match(miraPage, /await checkMarketplaceAdmin\(\)/);
  assert.match(miraPage, /generateMarketplaceManifestDraft\(/);
  assert.match(miraPage, /role: "user", content: text/);
  assert.match(miraPage, /previousManifest/);
  assert.match(miraPage, /MiraMarketplaceDraftPreview/);
  assert.match(miraPage, /confirmed: true as const/);
  assert.match(miraPage, /angehängten Dateien habe ich für diesen Entwurf nicht gesendet/);
  assert.doesNotMatch(
    customApps,
    /ADMIN-APP-BUILDER|Was soll die App tun\?|Mit Mira entwerfen|Mit Mira bearbeiten/,
  );
  assert.doesNotMatch(customApps, /generateMarketplaceManifestDraft/);
  assert.match(customApps, /Widerrufen …/);
  assert.match(
    marketplaceRoute,
    /<MarketplaceCustomApps userId=\{userId\} isAdmin=\{isMarketplaceAdmin\}/,
  );
});

test("the local chat preview uses the fixed manifest renderer and inline explicit publication confirmation", () => {
  assert.match(draftPreview, /<MarketplaceManifestView manifest=\{manifest\} preview \/>/);
  assert.match(draftPreview, /describeMarketplaceAuthoredPermissions\(manifest\)/);
  assert.match(draftPreview, /role="group"/);
  assert.match(draftPreview, /Ja, veröffentlichen/);
  assert.match(draftPreview, /noch nicht veröffentlicht/);
  assert.doesNotMatch(draftPreview, /\bDialog(?:Content|Description)?\b/);
});

test("Mira authoring shows only a validated structured manifest as the local chat preview", () => {
  assert.match(authoring, /extractTrailingMarketplaceJson/);
  assert.match(authoring, /return validateMarketplaceAuthoredManifest\(parsed\)/);
  const manifestIndex = miraPage.indexOf(
    "const manifest = await generateMarketplaceManifestDraft(",
  );
  const previewStateIndex = miraPage.indexOf("setMarketplaceDraft({", manifestIndex);
  assert.ok(manifestIndex >= 0 && previewStateIndex > manifestIndex);
  assert.match(draftPreview, /Lokale Vorschau · noch nicht veröffentlicht/);
  assert.match(draftPreview, /<MarketplaceManifestView manifest=\{manifest\} preview \/>/);
});

test("Mira game requests render a directly playable local quiz instead of a generic info app", () => {
  assert.match(chatIntent, /GAME_WORD/);
  assert.match(chatIntent, /GAME_WORD\.test\(message\)/);
  assert.match(miraPage, /manifest\.game/);
  assert.match(miraPage, /lokal spielbare Quiz/);
  assert.match(manifestRenderer, /MarketplaceQuizGameView/);
  assert.match(manifestRenderer, /game\.questions\.map/);
  assert.match(manifestRenderer, /Noch einmal spielen/);
  assert.match(manifestRenderer, /role="status" aria-live="polite"/);
  assert.match(manifestRenderer, /aria-disabled=\{answered\}/);
  assert.match(manifestRenderer, /aria-atomic="true"/);
  assert.match(appViewer, /getMarketplaceAuthoredActions\(checked\.manifest\)\.length > 0/);
  assert.match(appViewer, /keine zusätzlichen Alo-Berechtigungen/);
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

test("published admin apps keep their icon grid and launch through the reviewed app viewer", () => {
  assert.match(customApps, /MarketplaceIcon\s+icon=\{app\.manifest\.icon\}/);
  assert.match(customApps, /grid-cols-3[\s\S]*lg:grid-cols-6/);
  assert.match(customApps, /setSelectedAppId\(app\.appId\)/);
  assert.match(customApps, /!h-\[100dvh\] !w-screen !max-w-none/);
  assert.match(customApps, /Herunterladen & installieren/);
  assert.match(customApps, /AuthoredPermissionList manifest=\{selectedApp\.manifest\}/);
  assert.match(customApps, /<MarketplacePublishedAppViewer/);
  assert.match(customApps, /onInstallStateChange=\{persistInstallState\}/);
  assert.match(appViewer, /<MarketplaceManifestView/);
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

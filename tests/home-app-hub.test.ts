import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const homePath = resolve(root, "src/routes/_authenticated/index.tsx");
const home = readFileSync(homePath, "utf8");
const menusPath = resolve(root, "src/lib/home-app-menus.ts");
const menus = readFileSync(menusPath, "utf8");
const hubStart = home.indexOf("function HomeAppHub");
const tileBuilderStart = home.indexOf("function buildHomeHubTiles");
const artworkStart = home.indexOf("type HubArtworkKind");
const dashboardStart = home.indexOf("function Dashboard", artworkStart);
const hub = home.slice(hubStart, artworkStart);
const tileBuilder = home.slice(tileBuilderStart, hubStart);

test("Home keeps account sync active without rendering the explanatory status paragraph", () => {
  assert.match(home, /useHomeAppAccountSync\(user\.id\);/);
  assert.doesNotMatch(
    home,
    /accountSyncMessage|data-home-account-sync|Reihenfolge, Hintergründe und Aktionsfreigaben bleiben auf diesem Gerät/,
  );
});

test("Alo Home uses compact square app icons that open existing routes", () => {
  assert.notEqual(hubStart, -1, "HomeAppHub should exist");
  assert.notEqual(artworkStart, -1, "Hub artwork helpers should follow HomeAppHub");

  for (const [id, destination, routeFile] of [
    ["mira", "/ai", "ai.tsx"],
    ["nexus", "/chat", "chat.tsx"],
    ["health", "/health", "health.tsx"],
    ["settings", "/profile", "profile.tsx"],
    ["training", "/training", "training.tsx"],
  ] as const) {
    assert.ok(existsSync(resolve(root, "src/routes/_authenticated", routeFile)));
    assert.match(
      tileBuilder,
      new RegExp(`id: "${id}"[\\s\\S]*?to: "${destination}"`),
      `home tile should link directly to ${destination}`,
    );
  }

  assert.match(home, /"\/health": "sport"/);
  assert.match(hub, /grid-cols-4/);
  assert.match(
    tileBuilder,
    /kind: "community"[\s\S]*?id: "friends"[\s\S]*?title: "Freunde"[\s\S]*?artwork: "friends"/,
  );
  const communityRoutePath = resolve(root, "src/routes/_authenticated/settings.$category.tsx");
  const communityRoute = readFileSync(communityRoutePath, "utf8");
  const profilePage = readFileSync(
    resolve(root, "src/routes/_authenticated/profile-page-impl.tsx"),
    "utf8",
  );
  assert.ok(existsSync(communityRoutePath));
  assert.match(communityRoute, /isProfileSettingsCategory\(params\.category\)/);
  assert.match(
    hub,
    /if \(tile\.kind === "community"\)[\s\S]*?to="\/settings\/\$category"[\s\S]*?params=\{\{ category: "community" \}\}/,
  );
  assert.match(home, /if \(tile\.kind === "community"\) return "communication";/);
  assert.match(profilePage, /case "community"[\s\S]*?<FriendsPanel userId=\{profile\.id\} \/>/);
  assert.doesNotMatch(home, /aria-label="Freunde öffnen"|hash="profile-training"/);
  assert.match(hub, /aria-label="Profil und Einstellungen öffnen"/);
  assert.match(hub, /avatarUrl\s*\?/);
});

test("Home restores Areas, Training/Gym, Tools, and the curated Marketplace as app tiles", () => {
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/areas.tsx")));
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/tools.tsx")));
  assert.ok(existsSync(resolve(root, "src/routes/marketplace.tsx")));
  assert.match(tileBuilder, /id: "areas"[\s\S]*?to: "\/areas"/);
  assert.match(tileBuilder, /id: "marketplace"[\s\S]*?to: "\/marketplace"/);
  assert.match(hub, /tile\.to === "\/areas"/);
  assert.match(hub, /tile\.to === "\/tools"/);
  assert.match(tileBuilder, /id: "tools"[\s\S]*?to: "\/tools"/);
  assert.match(hub, /MarketplacePublishedAppViewer/);
  assert.match(tileBuilder, /if \(!install\.enabled\) continue/);

  const areaRoutes = [
    ["/health", "health.tsx"],
    ["/programs", "programs.tsx"],
    ["/calisthenics", "calisthenics.tsx"],
    ["/run", "run.tsx"],
    ["/season", "season.tsx"],
    ["/battle", "battle.index.tsx"],
    ["/battle-league", "battle-league.tsx"],
    ["/leaderboard", "leaderboard.tsx"],
    ["/clubs", "clubs.tsx"],
    ["/alarm", "alarm.tsx"],
  ] as const;
  for (const [destination, routeFile] of areaRoutes) {
    assert.ok(existsSync(resolve(root, "src/routes/_authenticated", routeFile)));
    assert.ok(menus.includes(`to: "${destination}"`), `Areas should retain ${destination}`);
  }

  for (const tool of ["today", "search", "capture", "collections", "shortcuts", "privacy"]) {
    assert.match(menus, new RegExp(`id: "${tool}"`));
  }
  assert.match(menus, /ALO_WORKSPACE_MENU_ORDER/);
  const toolsPage = readFileSync(resolve(root, "src/routes/_authenticated/tools.tsx"), "utf8");
  assert.match(toolsPage, /window\.dispatchEvent\(new CustomEvent\("alo-open"/);
  assert.match(toolsPage, /orderedTools\.map/);

  const areasPage = readFileSync(resolve(root, "src/routes/_authenticated/areas.tsx"), "utf8");
  assert.match(areasPage, /HOME_OTHER_AREAS\.map/);
  assert.match(areasPage, /to=\{to\}/);
});

test("fullscreen Home stays wide and black with a minimal lower pager", () => {
  const styles = readFileSync(resolve(root, "src/styles.css"), "utf8");
  const mobileStyles = readFileSync(resolve(root, "src/alo-mobile.css"), "utf8");
  const ruleBlock = (selector: string) => {
    const selectorStart = styles.indexOf(selector);
    assert.notEqual(selectorStart, -1, `fullscreen width rule should exist: ${selector}`);
    const openBrace = styles.indexOf("{", selectorStart);
    const closeBrace = styles.indexOf("}", openBrace);
    assert.ok(openBrace >= 0 && closeBrace > openBrace, `rule should be complete: ${selector}`);
    return styles.slice(openBrace + 1, closeBrace);
  };

  const rootRule = ruleBlock("main.alo-oneui9-fullscreen-home {");
  assert.match(rootRule, /max-width:\s*none !important/);
  assert.match(rootRule, /width:\s*100% !important/);
  const viewport = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) main.alo-oneui9-fullscreen-home {",
  );
  assert.match(viewport, /width:\s*100vw !important/);
  assert.match(viewport, /background:\s*#000 !important/);

  const home = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) main.alo-oneui9-fullscreen-home > .alo-tablet-home-hub {",
  );
  assert.match(home, /max-width:\s*none/);

  const homeSurface = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) main.alo-oneui9-fullscreen-home > .alo-oneui9-home {",
  );
  assert.match(homeSurface, /background:\s*#000 !important/);
  const homeBackdrop = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) .alo-oneui9-home::before {",
  );
  assert.match(homeBackdrop, /background:\s*none !important/);

  const apps = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) main.alo-oneui9-fullscreen-home .alo-tablet-home-apps {",
  );
  assert.match(apps, /max-width:\s*none/);

  const icon = ruleBlock(
    ".alo-oneui9-fullscreen-home .alo-tablet-home-apps :is(a, button, div) > span:first-child {",
  );
  assert.match(icon, /border-radius:\s*10px !important/);

  const page = ruleBlock(".alo-oneui9-fullscreen-home .alo-launcher-page {");
  assert.match(page, /grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/);
  const pager = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) .alo-launcher-page-indicators {",
  );
  assert.match(pager, /min-height:\s*0 !important/);
  assert.match(pager, /margin:\s*0 !important/);
  assert.match(pager, /padding:\s*0 !important/);
  assert.match(pager, /background:\s*transparent !important/);
  assert.match(pager, /box-shadow:\s*none !important/);
  assert.match(pager, /align-self:\s*end/);
  const pageDot = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) .alo-launcher-page-dot {",
  );
  assert.match(pageDot, /width:\s*0\.25rem !important/);
  const activePageDot = ruleBlock(
    "body:has(main.alo-oneui9-fullscreen-home) .alo-launcher-page-dot[aria-current=\"page\"] {",
  );
  assert.match(activePageDot, /width:\s*0\.55rem !important/);

  const gridStart = styles.indexOf(".alo-oneui9-home .alo-launcher-page .alo-tablet-home-apps");
  const gridEnd = styles.indexOf("@media (prefers-reduced-motion: reduce)", gridStart);
  const responsiveGridRules = styles.slice(gridStart, gridEnd);
  for (const columns of [4, 5, 6]) {
    assert.ok(
      responsiveGridRules.includes(`grid-template-columns: repeat(${columns}, minmax(0, 1fr))`),
      `${columns}-column One UI app-grid rule should remain intact`,
    );
  }

  const mobileGridSelector = "html[data-design-style] .alo-launcher-page .alo-tablet-home-apps {";
  const mobileGridStart = mobileStyles.indexOf(mobileGridSelector);
  const mobileGridEnd = mobileStyles.indexOf("}", mobileGridStart);
  assert.ok(mobileGridStart >= 0 && mobileGridEnd > mobileGridStart);
  assert.match(
    mobileStyles.slice(mobileGridStart, mobileGridEnd),
    /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/,
  );

  const narrowBreakpoint = mobileStyles.indexOf("@media (max-width: 380px)", mobileGridStart);
  const wideBreakpoint = mobileStyles.indexOf("@media (min-width: 768px)", narrowBreakpoint);
  assert.ok(narrowBreakpoint >= 0 && wideBreakpoint > narrowBreakpoint);
  assert.match(
    mobileStyles.slice(narrowBreakpoint, wideBreakpoint),
    /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
  );
  const wideGridStart = mobileStyles.indexOf(mobileGridSelector, wideBreakpoint);
  const wideGridEnd = mobileStyles.indexOf("}", wideGridStart);
  assert.ok(wideGridStart >= 0 && wideGridEnd > wideGridStart);
  assert.match(
    mobileStyles.slice(wideGridStart, wideGridEnd),
    /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/,
  );
});

function adminGateBlock(source: string): string {
  const start = source.indexOf("if (canSeeAdmin)");
  assert.ok(start >= 0, "the canSeeAdmin gate should exist");
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

test("Home game tiles are visible to every signed-in account and the Admin tile stays server-gated", () => {
  assert.match(hub, /getAdminAreaAccess\(\)/);
  assert.match(hub, /setCanSeeAdmin\(false\)/);
  assert.match(tileBuilder, /if \(canSeeAdmin\)[\s\S]*?id: "admin"[\s\S]*?to: "\/admin"/);
  const adminGates: string[] = [];
  let searchFrom = 0;
  while (true) {
    const gateStart = tileBuilder.indexOf("if (canSeeAdmin)", searchFrom);
    if (gateStart < 0) break;
    const gate = adminGateBlock(tileBuilder.slice(gateStart));
    adminGates.push(gate);
    searchFrom = gateStart + gate.length;
  }
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    assert.ok(
      tileBuilder.includes(`id: "${id}"`),
      `${id} should be registered as a Home game tile`,
    );
    assert.ok(
      adminGates.every((gate) => !gate.includes(`id: "${id}"`)),
      `${id} should not be gated to Admins`,
    );
  }
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/games.tsx")));
  assert.equal(existsSync(resolve(root, "src/routes/games.tsx")), false);
  assert.match(tileBuilder, /if \(plugin\.action\.type === "open-game"\) continue/);
  assert.match(home, /to="\/games"[\s\S]*search=\{\{ game \}\}/);
  assert.doesNotMatch(hub, /grid-defense\.html|kupferkern\.html|srcDoc=/);
});

test("Home Marketplace entry is available to every signed-in account and remounts on account change", () => {
  const dashboard = home.slice(dashboardStart);
  assert.match(dashboard, /<HomeAppHub[\s\S]*?key=\{user\.id\}/);
  assert.match(hub, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.match(hub, /setCanSeeAdmin\(false\)/);
  assert.match(tileBuilder, /id: "marketplace"[\s\S]*?to: "\/marketplace"/);
  assert.doesNotMatch(adminGateBlock(tileBuilder), /id: "marketplace"/);
});

test("installed Marketplace catalog apps become Home tiles for every account (Alo 1.151)", () => {
  assert.match(tileBuilder, /pluginState: MarketplaceInstallState/);
  assert.match(tileBuilder, /kind: "plugin"/);
  assert.match(tileBuilder, /id: `plugin:\$\{plugin\.id\}`/);
  assert.match(tileBuilder, /installedPluginIds\.includes\(plugin\.id\)/);
  assert.match(tileBuilder, /enabledPluginIds\.includes\(plugin\.id\)/);
  assert.match(tileBuilder, /standardRoutes\.has\(plugin\.action\.to\)\) continue/);
  assert.match(tileBuilder, /plugin\.action\.type === "open-game"\) continue/);
  assert.doesNotMatch(adminGateBlock(tileBuilder), /MARKETPLACE_CATALOG/);
  assert.match(hub, /loadMarketplaceInstallState\(window\.localStorage, user\.id\)/);
  assert.match(hub, /marketplaceInstallStorageKey\(user\.id\)/);
  assert.match(hub, /openPluginAction\(tile\.action\)/);
  assert.match(hub, /navigate\(\{ to: "\/games", search: \{ game: action\.gameId \} \}\)/);
  assert.match(hub, /new CustomEvent\("alo-open", \{ detail: action\.toolId \}\)/);
  assert.match(hub, /removeMarketplacePlugin\(pluginState, pluginId\)/);
  assert.match(hub, /saveMarketplaceInstallState\(window\.localStorage, user\.id, next\)/);
});

test("app artwork is square and original, and training is no longer a collapsible Home card", () => {
  const artwork = home.slice(artworkStart, dashboardStart);
  assert.notEqual(dashboardStart, -1);
  assert.match(artwork, /<svg[\s\S]*?viewBox="74 0 132 132"/);
  for (const kind of [
    "mira",
    "nexus",
    "health",
    "friends",
    "settings",
    "more",
    "training",
    "tools",
    "marketplace",
    "gridDefense",
    "kupferkern",
  ]) {
    assert.ok(artwork.includes(`kind === "${kind}"`), `${kind} artwork should be present`);
  }

  assert.doesNotMatch(
    home,
    /training-overview|onOpenTrainingOverview|overview\.open|scrollIntoView/,
  );
  assert.doesNotMatch(home, /<GymPartnerPanel|<DashboardGrid/);
  const training = readFileSync(resolve(root, "src/components/TrainingDashboard.tsx"), "utf8");
  assert.match(training, /<GymPartnerPanel \/>/);
  assert.match(training, /<DashboardGrid renderWidget=\{renderWidget\} \/>/);
});

test("every primary app offers a visible route back to the Alo home screen", () => {
  const primaryPages = [
    [
      "src/components/mira/SuperAiPage.tsx",
      /to="\/"[\s\S]*?Startseite|aria-label="Zur Alo-Startseite"/,
    ],
    ["src/components/chat/LocalChatShell.tsx", /aria-label="Zur Alo-Startseite"[\s\S]*?Startseite/],
    ["src/routes/_authenticated/exercises.tsx", /to="\/"[\s\S]*?← Startseite/],
    ["src/routes/_authenticated/profile-page-impl.tsx", /to="\/"[\s\S]*?← Startseite/],
  ] as const;
  for (const [relativePath, homeLinkPattern] of primaryPages) {
    const page = readFileSync(resolve(root, relativePath), "utf8");
    assert.match(page, homeLinkPattern, `${relativePath} should expose a Startseite link`);
  }
});

test("every authenticated section keeps a clearly named route to Alo Home", () => {
  const homeSources = [
    ["Mira", "src/components/mira/SuperAiPage.tsx", /mira-chat-home-action|<AloHomeLink/],
    ["Nexus Chat", "src/components/chat/LocalChatShell.tsx", /aria-label="Zur Alo-Startseite"/],
    ["Übungen", "src/routes/_authenticated/exercises.tsx", /Startseite/],
    ["Profil", "src/routes/_authenticated/profile-page-impl.tsx", /Startseite/],
    ["Smart Coach", "src/routes/_authenticated/coach.tsx", /<AloHomeLink/],
    ["Health", "src/routes/_authenticated/health.tsx", /<AloHomeLink/],
    ["Calisthenics", "src/routes/_authenticated/calisthenics.tsx", /<AloHomeLink/],
    ["Laufen", "src/routes/_authenticated/run.tsx", /<AloHomeLink/],
    ["Programme", "src/routes/_authenticated/programs.tsx", /<AloHomeLink/],
    ["Battle-Lobby", "src/routes/_authenticated/battle.index.tsx", /<AloHomeLink/],
    ["Battle-Liga", "src/routes/_authenticated/battle-league.tsx", /<AloHomeLink/],
    ["Battle-Warteraum", "src/routes/_authenticated/battle.$id.tsx", /<AloHomeLink/],
    ["Clubs", "src/routes/_authenticated/clubs.tsx", /<AloHomeLink/],
    ["Leaderboard", "src/routes/_authenticated/leaderboard.tsx", /<AloHomeLink/],
    ["Saison", "src/routes/_authenticated/season.tsx", /<AloHomeLink/],
    ["Cali-Workout", "src/routes/_authenticated/cali-workout.$skillId.tsx", /<AloHomeLink/],
    ["Workout", "src/routes/_authenticated/workout.$exerciseId.tsx", /<AloHomeLink/],
  ] as const;
  for (const [section, relativePath, homePattern] of homeSources) {
    const source = readFileSync(resolve(root, relativePath), "utf8");
    assert.match(source, homePattern, `${section} should expose a clearly named Home action`);
  }

  const appNavigation = readFileSync(resolve(root, "src/components/TopNav.tsx"), "utf8");
  assert.match(appNavigation, /to: "\/", label: "Startseite", icon: House/);
  assert.match(
    appNavigation,
    /const barVisible = enabled && bottomLayout && scrollVisible && !hideModuleChrome/,
  );
  assert.match(appNavigation, /export function BottomNav\(\) \{\s*return null;/);
});

test("Home edit mode uses empty-area hold, direct icon drag, keyboard movement, and local removal", () => {
  assert.match(hub, /data-home-app-id=\{tile\.id\}/);
  assert.match(hub, /startHomeLongPress\(event, tile\.id\)/);
  assert.match(hub, /onPointerDown=\{startEmptyHomeLongPress\}/);
  assert.match(hub, /target\.closest\([\s\S]*data-home-app-id/);
  assert.match(hub, /onKeyDown=\{handleHomeHubKeyDown\}/);
  assert.match(hub, /longPressTriggeredAppIdRef\.current = appId/);
  assert.match(hub, /onClickCapture=\{\(event\) => suppressLongPressClick\(event, tile\.id\)\}/);
  assert.match(hub, /window\.addEventListener\("pointerup", cancelOnPointerEnd, true\)/);
  assert.match(hub, /window\.addEventListener\("pointercancel", cancelOnPointerEnd, true\)/);
  assert.match(
    hub,
    /window\.addEventListener\("lostpointercapture", cancelOnLostPointerCapture, true\)/,
  );
  assert.match(hub, /window\.addEventListener\("pointermove", startPendingHomeTileDrag, true\)/);
  assert.match(hub, /onContextMenu=\{/);
  assert.match(hub, /pendingHomeDragRef\.current = \{\s*appId: tile\.id/);
  assert.match(hub, /pendingDrag\.pointerId !== event\.pointerId/);
  assert.match(
    hub,
    /const startPendingHomeTileDrag = \(event: PointerEvent\) => \{[\s\S]*?hasHomeAppDragThreshold\(pendingDrag, event\.clientX, event\.clientY\)[\s\S]*?beginHomeTileDrag\(event, pendingDrag\.appId, pendingDrag\.element\)/,
  );
  assert.match(hub, /!isEditingHubRef\.current/);
  assert.equal(hub.match(/setIsEditingHub\(/g)?.length, 1);
  assert.match(hub, /setHomeEditingMode\(true\)/);
  assert.match(hub, /onPointerMoveCapture=\{moveHomeTileDrag\}/);
  const tilePointerDownStart = hub.indexOf("onPointerDown={(event) => {");
  const tilePointerDownEnd = hub.indexOf("onPointerUp=", tilePointerDownStart);
  assert.doesNotMatch(hub.slice(tilePointerDownStart, tilePointerDownEnd), /setPointerCapture/);
  assert.match(
    hub,
    /pendingHomeDragRef\.current = null;\s*\}\s*dragSourceAppIdRef\.current = null/,
  );
  const beginDragStart = hub.indexOf("const beginHomeTileDrag");
  const beginDragEnd = hub.indexOf("const moveHomeTileDrag", beginDragStart);
  const beginDrag = hub.slice(beginDragStart, beginDragEnd);
  assert.match(beginDrag, /if \(!event\.isPrimary\) return/);
  assert.doesNotMatch(beginDrag, /event\.button/);
  assert.match(beginDrag, /sourceElement\.setPointerCapture\(event\.pointerId\)/);
  assert.match(beginDrag, /Das App-Symbol konnte nicht verschoben werden/);
  assert.match(
    hub,
    /if \(isEditingHub && event\.isPrimary && event\.button === 0\)[\s\S]*?pendingHomeDragRef\.current =/,
  );
  assert.match(hub, /finishHomeTileDrag\(event\)/);
  assert.match(
    hub,
    /moveHomeAppRelative\(settings, visibleAppIds, sourceId, drop\.appId, drop\.placement\)/,
  );
  assert.match(hub, /role=\{isEditingHub \? "button" : undefined\}/);
  assert.match(hub, /keyboardGrabbedAppId === appId/);
  assert.match(hub, /event\.key !== "ArrowLeft" && event\.key !== "ArrowRight"/);
  assert.match(hub, /freie Stelle lange drücken/);
  const renderTileStart = hub.indexOf("const renderTile =");
  const editBranch = hub.indexOf("if (isEditingHub) {", renderTileStart);
  const firstRouteLink = hub.indexOf("<Link", editBranch);
  assert.ok(editBranch > renderTileStart && firstRouteLink > editBranch);
  assert.match(hub.slice(editBranch, firstRouteLink), /<div className=\{HUB_APP_ICON_CLASS_NAME\}/);
  assert.doesNotMatch(hub, /GripVertical|MoreHorizontal|Pencil|Home-Apps anpassen/);
  assert.doesNotMatch(hub, /mt-2 flex flex-wrap items-center justify-center gap-1/);
  assert.match(hub, /setActiveAppMenuId\(appId\)/);
  assert.match(hub, /Deinstallieren/);
  assert.match(hub, /removeMarketplacePublishedApp\(installState, appId\)/);
  assert.match(hub, /forgetHomeAppPersonalization\(settings, uninstallTargetTile\.id\)/);
  assert.match(hub, /Marketplace-Eintrag bleibt/);
  assert.match(hub, /allen angemeldeten Geräten/);
  assert.doesNotMatch(hub, /publishMarketplaceApp|revokeMarketplaceApp/);
});

test("a second touch cancels Home gestures and cannot arm another app long-press", () => {
  assert.match(
    hub,
    /const cancelOnAdditionalTouch = \(event: PointerEvent\) => \{\s*if \(event\.pointerType !== "touch" \|\| event\.isPrimary\) return;\s*cancelHomeLongPress\(\);\s*clearHomeTileDrag\(\);/,
  );
  assert.match(hub, /window\.addEventListener\("pointerdown", cancelOnAdditionalTouch, true\)/);
  assert.match(hub, /window\.removeEventListener\("pointerdown", cancelOnAdditionalTouch, true\)/);
  const start = hub.slice(
    hub.indexOf("const startHomeLongPress"),
    hub.indexOf("const startEmptyHomeLongPress"),
  );
  assert.match(start, /!event\.isPrimary/);
  assert.ok(start.indexOf("!event.isPrimary") < start.indexOf("cancelHomeLongPress()"));
});

test("secondary-section Home actions remain available in both visual variants", () => {
  const bothVariantPages = [
    "battle.index.tsx",
    "battle-league.tsx",
    "battle.$id.tsx",
    "calisthenics.tsx",
    "clubs.tsx",
    "health.tsx",
    "leaderboard.tsx",
    "programs.tsx",
    "run.tsx",
    "season.tsx",
    "workout.$exerciseId.tsx",
    "cali-workout.$skillId.tsx",
  ];
  for (const routeFile of bothVariantPages) {
    const source = readFileSync(resolve(root, "src/routes/_authenticated", routeFile), "utf8");
    const homeActions = source.match(/<AloHomeLink\b/g) ?? [];
    assert.ok(
      homeActions.length >= 2,
      `${routeFile} should expose a Home action in both visual variants and relevant states`,
    );
  }
});

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

test("Alo Home uses compact square app icons that open existing routes", () => {
  assert.notEqual(hubStart, -1, "HomeAppHub should exist");
  assert.notEqual(artworkStart, -1, "Hub artwork helpers should follow HomeAppHub");

  for (const [id, destination, routeFile] of [
    ["mira", "/ai", "ai.tsx"],
    ["nexus", "/chat", "chat.tsx"],
    ["health", "/exercises", "exercises.tsx"],
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

  assert.match(hub, /grid-cols-4/);
  assert.match(hub, /aria-label="Freunde öffnen"/);
  assert.match(hub, /to="\/profile"\s+hash="profile-training"/);
  assert.match(hub, /aria-label="Profil und Einstellungen öffnen"/);
  assert.match(hub, /avatarUrl\s*\?/);
});

test("Home restores Areas, Training/Gym, Tools, and the curated Marketplace as app tiles", () => {
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/areas.tsx")));
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/tools.tsx")));
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/marketplace.tsx")));
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

test("the Home game tiles require confirmed Admin access and open only protected games", () => {
  assert.match(hub, /getAdminAreaAccess\(\)/);
  assert.match(hub, /setCanSeeAdmin\(false\)/);
  assert.match(tileBuilder, /if \(canSeeAdmin\)[\s\S]*?id: "admin"[\s\S]*?to: "\/admin"/);
  assert.match(tileBuilder, /id: "grid-defense"[\s\S]*?game: "grid-defense"/);
  assert.match(tileBuilder, /id: "kupferkern"[\s\S]*?game: "kupferkern"/);
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/games.tsx")));
  assert.match(home, /to="\/games"[\s\S]*search=\{\{ game \}\}/);
  assert.doesNotMatch(hub, /grid-defense\.html|kupferkern\.html|srcDoc=/);
});

test("Home Admin-only Marketplace entry remounts immediately when the account changes", () => {
  const dashboard = home.slice(dashboardStart);
  assert.match(dashboard, /<HomeAppHub[\s\S]*?key=\{user\.id\}/);
  assert.match(hub, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.match(hub, /setCanSeeAdmin\(false\)/);
  assert.match(hub, /getAdminAreaAccess\(\)[\s\S]*?isMarketplaceAdminAccessGranted\(access\)/);
  assert.match(tileBuilder, /if \(canSeeAdmin\)[\s\S]*?id: "marketplace"/);
});

test("app artwork is square and original, and training is no longer a collapsible Home card", () => {
  const artwork = home.slice(artworkStart, dashboardStart);
  assert.notEqual(dashboardStart, -1);
  assert.match(artwork, /<svg[\s\S]*?viewBox="74 0 132 132"/);
  for (const kind of [
    "mira",
    "nexus",
    "health",
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

test("Home edit mode supports pointer drag, accessible Long-Press actions, and local Marketplace removal", () => {
  assert.match(hub, /data-home-app-id=\{tile\.id\}/);
  assert.match(hub, /startHomeLongPress\(event, tile\.id\)/);
  assert.match(hub, /longPressTriggeredAppIdRef\.current = appId/);
  assert.match(hub, /onClickCapture=\{\(event\) => suppressLongPressClick\(event, tile\.id\)\}/);
  assert.match(hub, /window\.addEventListener\("pointerup", cancelOnPointerEnd, true\)/);
  assert.match(hub, /window\.addEventListener\("pointercancel", cancelOnPointerEnd, true\)/);
  assert.match(hub, /onContextMenu=\{/);
  assert.match(hub, /beginHomeTileDrag\(event, tile\.id\)/);
  assert.match(hub, /onPointerMove=\{moveHomeTileDrag\}/);
  assert.match(hub, /finishHomeTileDrag\}/);
  assert.match(
    hub,
    /moveHomeAppRelative\(settings, visibleAppIds, sourceId, drop\.appId, drop\.placement\)/,
  );
  assert.match(hub, /GripVertical/);
  assert.match(hub, /setActiveAppMenuId\(appId\)/);
  assert.match(hub, /Lokal deinstallieren/);
  assert.match(hub, /removeMarketplacePublishedApp\(installState, appId\)/);
  assert.match(hub, /forgetHomeAppPersonalization\(settings, uninstallTargetTile\.id\)/);
  assert.match(hub, /Der Marketplace-Eintrag bleibt erhalten/);
  assert.doesNotMatch(hub, /publishMarketplaceApp|revokeMarketplaceApp/);
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

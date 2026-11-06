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
const artworkStart = home.indexOf("type HubArtworkKind");
const dashboardStart = home.indexOf("function Dashboard", artworkStart);
const hub = home.slice(hubStart, artworkStart);

test("Alo Home uses compact square app icons that open existing routes", () => {
  assert.notEqual(hubStart, -1, "HomeAppHub should exist");
  assert.notEqual(artworkStart, -1, "Hub artwork helpers should follow HomeAppHub");

  for (const [destination, routeFile, title, artwork] of [
    ["/ai", "ai.tsx", "Mira", "mira"],
    ["/chat", "chat.tsx", "Nexus Chat", "nexus"],
    ["/exercises", "exercises.tsx", "Alo Health", "health"],
    ["/profile", "profile.tsx", "Einstellungen", "settings"],
    ["/training", "training.tsx", "Trainingsübersicht & Gym", "training"],
    ["/marketplace", "marketplace.tsx", "Marketplace", "marketplace"],
  ] as const) {
    assert.ok(existsSync(resolve(root, "src/routes/_authenticated", routeFile)));
    assert.ok(
      hub.includes(`<HubAppIcon to="${destination}" title="${title}" artwork="${artwork}"`),
      `home icon should link directly to ${destination}`,
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
  assert.match(hub, /to="\/areas"[\s\S]*?Weitere Bereiche/);
  assert.match(
    hub,
    /<HubAppIcon to="\/training" title="Trainingsübersicht & Gym" artwork="training"/,
  );
  assert.match(hub, /to="\/tools"[\s\S]*?Alo-Werkzeuge/);
  assert.match(hub, /<HubAppIcon to="\/marketplace" title="Marketplace" artwork="marketplace"/);

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
  assert.match(
    hub,
    /canSeeAdmin\s*&&\s*<HubAppIcon to="\/admin" title="Admin" artwork="admin" \/>/,
  );
  assert.match(
    hub,
    /canSeeAdmin\s*&&\s*\([\s\S]*HubGameAppIcon game="grid-defense" title="Grid Defense"[\s\S]*HubGameAppIcon game="kupferkern" title="Kupferkern"/,
  );
  assert.ok(existsSync(resolve(root, "src/routes/_authenticated/games.tsx")));
  assert.match(home, /to="\/games"[\s\S]*search=\{\{ game \}\}/);
  assert.doesNotMatch(hub, /grid-defense\.html|kupferkern\.html|srcDoc=/);
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

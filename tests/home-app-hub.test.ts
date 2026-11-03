import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const homePath = resolve(process.cwd(), "src/routes/_authenticated/index.tsx");
const home = readFileSync(homePath, "utf8");
const hubStart = home.indexOf("function HomeAppHub");
const artworkStart = home.indexOf("function HubArtwork");
const dashboardStart = home.indexOf("function Dashboard", artworkStart);
const hub = home.slice(hubStart, artworkStart);

test("Alo Home uses compact square app icons that open existing routes", () => {
  assert.notEqual(hubStart, -1, "HomeAppHub should exist");
  assert.notEqual(artworkStart, -1, "HubArtwork should follow HomeAppHub");

  for (const [destination, routeFile, title, artwork] of [
    ["/ai", "ai.tsx", "Mira", "mira"],
    ["/chat", "chat.tsx", "Nexus Chat", "nexus"],
    ["/exercises", "exercises.tsx", "Alo Health", "health"],
    ["/profile", "profile.tsx", "Einstellungen", "settings"],
  ] as const) {
    assert.ok(existsSync(resolve(process.cwd(), "src/routes/_authenticated", routeFile)));
    assert.ok(
      hub.includes(`<HubAppIcon to="${destination}" title="${title}" artwork="${artwork}"`),
      `home icon should link directly to ${destination}`,
    );
  }

  assert.match(hub, /grid-cols-4[\s\S]*?sm:grid-cols-5/);
  assert.match(hub, /aspect-square w-full max-w-\[72px\]/);
  assert.match(hub, /aria-label="Freunde öffnen"/);
  assert.match(hub, /to="\/profile"\s+hash="profile-training"/);
  assert.match(hub, /aria-label="Profil und Einstellungen öffnen"/);
  assert.match(hub, /avatarUrl\s*\?/);
});

test("the planned original game remains visible but locked and non-interactive", () => {
  const gameStart = hub.indexOf('aria-label="Spiel-App, gesperrt und noch nicht verfügbar"');
  assert.notEqual(gameStart, -1);
  const gameEnd = hub.indexOf("</nav>", gameStart);
  const game = hub.slice(gameStart, gameEnd);
  assert.match(game, /Spiel/);
  assert.match(game, /Gesperrt/);
  assert.match(game, /<LockKeyhole/);
  assert.doesNotMatch(game, /<Link\b|href=|onClick=/);
  assert.doesNotMatch(game, /\.from\(|fetch\(|\.insert\(|dispatchEvent\(/);
});

test("the icon artwork is square and original, and the training dashboard stays collapsible", () => {
  const artwork = home.slice(artworkStart, dashboardStart);
  assert.notEqual(artworkStart, -1);
  assert.match(artwork, /<svg[\s\S]*?viewBox="74 0 132 132"/);
  assert.match(artwork, /kind === "mira"/);
  assert.match(artwork, /kind === "nexus"/);
  assert.match(artwork, /kind === "health"/);
  assert.match(artwork, /kind === "settings"/);

  const trainingSection = home.slice(home.indexOf('id="training-overview"'));
  assert.match(trainingSection, /<summary[\s\S]*?Trainingsübersicht & Gym-Partner/);
  assert.match(trainingSection, /<GymPartnerPanel \/>/);
  assert.match(trainingSection, /<DashboardGrid renderWidget=\{renderWidget\} \/>/);
  assert.doesNotMatch(trainingSection.slice(0, trainingSection.indexOf(">")), /\bopen\b/);
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
    const page = readFileSync(resolve(process.cwd(), relativePath), "utf8");
    assert.match(page, homeLinkPattern, `${relativePath} should expose a Startseite link`);
  }
});

test("home hub keeps every former shared-menu destination and workspace action reachable", () => {
  for (const [destination, routeFile] of [
    ["/health", "health.tsx"],
    ["/programs", "programs.tsx"],
    ["/calisthenics", "calisthenics.tsx"],
    ["/run", "run.tsx"],
    ["/season", "season.tsx"],
    ["/battle", "battle.index.tsx"],
    ["/battle-league", "battle-league.tsx"],
    ["/leaderboard", "leaderboard.tsx"],
    ["/clubs", "clubs.tsx"],
  ] as const) {
    assert.ok(existsSync(resolve(process.cwd(), "src/routes/_authenticated", routeFile)));
    assert.ok(home.includes(`to: "${destination}"`), `hub should link to ${destination}`);
  }
  assert.match(hub, /aria-label="Alo-Werkzeuge öffnen"/);
  assert.match(hub, /detail: "menu"/);
  assert.match(hub, /aria-label="Überall suchen"/);
  assert.match(hub, /detail: "search"/);
  assert.match(hub, /aria-label="Weitere Alo-Bereiche"/);
});

test("every authenticated section exposes a clearly named route to the Alo home hub", () => {
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
    const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
    assert.match(source, homePattern, `${section} should expose a clearly named Home action`);
  }

  const appNavigation = readFileSync(resolve(process.cwd(), "src/components/TopNav.tsx"), "utf8");
  assert.match(appNavigation, /to: "\/", label: "Startseite", icon: House/);
  assert.match(
    appNavigation,
    /const barVisible = enabled && bottomLayout && scrollVisible && !hideModuleChrome/,
  );
  assert.match(appNavigation, /export function BottomNav\(\) \{\s*return null;/);
});

test("Home actions appear in both visual variants of every secondary section", () => {
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
    const source = readFileSync(
      resolve(process.cwd(), "src/routes/_authenticated", routeFile),
      "utf8",
    );
    const homeActions = source.match(/<AloHomeLink\b/g) ?? [];
    assert.ok(
      homeActions.length >= 2,
      `${routeFile} should expose a Home action in both visual variants and relevant states`,
    );
  }
});

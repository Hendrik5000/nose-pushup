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

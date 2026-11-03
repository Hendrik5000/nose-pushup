import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const homePath = resolve(process.cwd(), "src/routes/_authenticated/index.tsx");
const home = readFileSync(homePath, "utf8");
const homeStyles = readFileSync(resolve(process.cwd(), "src/alo-mobile.css"), "utf8");
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

  assert.match(hub, /alo-tablet-home-apps grid[^"]*grid-cols-4/);
  assert.doesNotMatch(hub, /sm:grid-cols-5/);
  assert.match(hub, /aspect-square w-full max-w-\[96px\]/);
  assert.match(hub, /aria-label="Freunde öffnen"/);
  assert.match(hub, /to="\/profile"\s+hash="profile-training"/);
  assert.match(hub, /aria-label="Profil und Einstellungen öffnen"/);
  assert.match(hub, /avatarUrl\s*\?/);
});

test("search is a labeled icon action in the header while Alo tools remain a full-width action", () => {
  const header = hub.slice(hub.indexOf("<header"), hub.indexOf("</header>"));
  const tools = hub.slice(
    hub.indexOf("alo-tablet-home-tools"),
    hub.indexOf('id="more-areas-panel"'),
  );
  assert.match(header, /aria-label="Überall suchen"/);
  assert.match(header, /<Search className/);
  assert.match(header, /detail: "search"/);
  assert.doesNotMatch(header, />\s*Überall suchen\s*</);
  assert.match(tools, /aria-label="Alo-Werkzeuge öffnen"/);
  assert.match(tools, /w-full/);
  assert.doesNotMatch(tools, /Überall suchen|detail: "search"/);
});

test("the other-areas app tile opens a labeled panel with all existing destinations", () => {
  const panelStart = hub.indexOf('id="more-areas-panel"');
  const moreAreas = hub.slice(panelStart);
  assert.match(hub, /aria-expanded=\{moreAreasOpen\}/);
  assert.match(hub, /aria-controls="more-areas-panel"/);
  assert.match(hub, /title="Weitere Bereiche" artwork="more"/);
  assert.match(hub, /Weitere Bereiche öffnen \(\$\{MORE_AREAS\.length\}\)/);
  assert.match(moreAreas, /alo-tablet-home-more/);
  assert.match(moreAreas, /hidden=\{!moreAreasOpen\}/);
  assert.match(moreAreas, /<h2[^>]*>\s*Weitere Bereiche/);
  assert.match(moreAreas, /MORE_AREAS\.length/);
  assert.match(moreAreas, /aria-label="Weitere Alo-Bereiche"/);
  assert.match(moreAreas, /MORE_AREAS\.map/);
});

test("the Training & Gym app tile opens the existing training and partner overview", () => {
  assert.match(hub, /aria-label="Trainingsübersicht & Gym öffnen"/);
  assert.match(hub, /title="Trainingsübersicht & Gym" artwork="training"/);
  assert.match(home, /onOpenTrainingOverview=\{openTrainingOverview\}/);
  assert.match(home, /overview\.open = true/);
  assert.match(home, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  const trainingSection = home.slice(home.indexOf('id="training-overview"'));
  assert.match(trainingSection, /<GymPartnerPanel \/>/);
  assert.match(trainingSection, /<DashboardGrid renderWidget=\{renderWidget\} \/>/);
});

test("Home Mira voice overlay hands an editable question to the existing Mira app", () => {
  const launcherStart = home.indexOf("function MiraOverlayLauncher");
  const launcherEnd = home.indexOf("type HubArtworkKind", launcherStart);
  const launcher = home.slice(launcherStart, launcherEnd);
  const voiceDialog = readFileSync(
    resolve(process.cwd(), "src/components/mira/MiraVoiceChatDialog.tsx"),
    "utf8",
  );
  const handoff = readFileSync(
    resolve(process.cwd(), "src/components/alo/MiraHandoff.tsx"),
    "utf8",
  );
  const miraRoute = readFileSync(
    resolve(process.cwd(), "src/routes/_authenticated/ai.tsx"),
    "utf8",
  );

  assert.notEqual(launcherStart, -1);
  assert.match(launcher, /createBrowserSpeechRecognitionFactory/);
  assert.match(launcher, /<MiraVoiceChatDialog/);
  assert.match(launcher, /onContinue=\{continueToMira\}/);
  assert.match(launcher, /<MiraHandoff[\s\S]*?text=\{handoffRequest\.text\}/);
  assert.match(launcher, /openOnMount/);
  assert.doesNotMatch(launcher, /<SuperAiPage|superAiChat|submit\(/);
  assert.match(voiceDialog, /Erkannten Text bearbeiten/);
  assert.match(voiceDialog, /Mira wird nicht automatisch kontaktiert/);
  assert.doesNotMatch(handoff, /superAiChat|fetch\(|submit\(/);
  assert.match(miraRoute, /<SuperAiPage sketchLayout \/>/);
});

test("tablet Home keeps the narrow centered canvas, four-icon row, and matching training card", () => {
  assert.match(home, /max-w-\[32rem\]/);
  assert.match(homeStyles, /main\.alo-tablet-home-page\s*\{\s*max-width:\s*32rem;/);
  assert.match(homeStyles, /\.alo-tablet-home-apps\s*\{\s*grid-template-columns:\s*repeat\(4,/);
  assert.match(
    homeStyles,
    /\.alo-tablet-home-page #training-overview\s*\{[\s\S]*?max-width:\s*32rem;/,
  );
});

test("the Home exposes two separate game icons only after a server-confirmed Admin check", () => {
  assert.match(home, /getAdminAreaAccess\(\)/);
  const gatedGameIcons = home.match(/\{canSeeAdmin\s*&&\s*\([\s\S]*?\)\}/)?.[0] ?? "";
  assert.match(
    gatedGameIcons,
    /<HubGameAppIcon game="grid-defense" title="Grid Defense" artwork="gridDefense" \/>/,
  );
  assert.match(
    gatedGameIcons,
    /<HubGameAppIcon game="kupferkern" title="Kupferkern" artwork="kupferkern" \/>/,
  );
  assert.match(home, /function HubGameAppIcon[\s\S]*?to="\/games"[\s\S]*?search=\{\{ game \}\}/);
  assert.doesNotMatch(home, /title="Admin-Spiele"/);
  assert.match(home, /setCanSeeAdmin\(false\)/);
  assert.ok(existsSync(resolve(process.cwd(), "src/routes/_authenticated/games.tsx")));
  assert.doesNotMatch(hub, /Spiel-App, gesperrt|LockKeyhole|Gesperrt/);
  assert.doesNotMatch(hub, /grid-defense\.html|kupferkern\.html|srcDoc=/);
});

test("the icon artwork is square and original, and the training dashboard stays collapsible", () => {
  const artwork = home.slice(artworkStart, dashboardStart);
  assert.notEqual(artworkStart, -1);
  assert.match(artwork, /<svg[\s\S]*?viewBox="74 0 132 132"/);
  assert.match(artwork, /kind === "mira"/);
  assert.match(artwork, /kind === "nexus"/);
  assert.match(artwork, /kind === "health"/);
  assert.match(artwork, /kind === "settings"/);
  assert.match(artwork, /kind === "gridDefense"/);
  assert.match(artwork, /kind === "kupferkern"/);
  assert.match(artwork, /kind === "more"/);
  assert.match(artwork, /kind === "training"/);
  assert.doesNotMatch(artwork, /kind === "adventure"/);

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

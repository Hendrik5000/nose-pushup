import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const homePath = resolve(process.cwd(), "src/routes/_authenticated/index.tsx");
const home = readFileSync(homePath, "utf8");
const homeStyles = readFileSync(resolve(process.cwd(), "src/alo-mobile.css"), "utf8");
const miraHomeStyles = readFileSync(resolve(process.cwd(), "src/mira-home-overlay.css"), "utf8");
const homeMenus = readFileSync(resolve(process.cwd(), "src/lib/home-app-menus.ts"), "utf8");
const customizationDialog = readFileSync(
  resolve(process.cwd(), "src/components/home/HomeAppCustomizationDialog.tsx"),
  "utf8",
);
const hubStart = home.indexOf("function HomeAppHub");
const artworkStart = home.indexOf("function HubArtwork");
const dashboardStart = home.indexOf("function Dashboard", artworkStart);
const hub = home.slice(hubStart, artworkStart);

test("Alo Home uses compact square app icons that open existing routes", () => {
  assert.notEqual(hubStart, -1, "HomeAppHub should exist");
  assert.notEqual(artworkStart, -1, "HubArtwork should follow HomeAppHub");

  for (const [id, destination, routeFile, title, artwork] of [
    ["mira", "/ai", "ai.tsx", "Mira", "mira"],
    ["nexus", "/chat", "chat.tsx", "Nexus Chat", "nexus"],
    ["health", "/health", "health.tsx", "Alo Health", "health"],
    ["settings", "/profile", "profile.tsx", "Einstellungen", "settings"],
  ] as const) {
    assert.ok(existsSync(resolve(process.cwd(), "src/routes/_authenticated", routeFile)));
    assert.match(
      hub,
      new RegExp(
        `id: "${id}"[\\s\\S]*?title: "${title}"[\\s\\S]*?artwork: "${artwork}"[\\s\\S]*?kind: "route"[\\s\\S]*?to: "${destination}"`,
      ),
      `home app ${id} should open ${destination}`,
    );
  }

  assert.match(hub, /alo-tablet-home-apps grid[^"]*grid-cols-4/);
  assert.doesNotMatch(hub, /sm:grid-cols-5/);
  assert.match(hub, /aspect-square w-full max-w-\[96px\]/);
  assert.match(hub, /aria-label="Startseite anpassen"/);
  assert.match(hub, /aria-haspopup="dialog"/);
  assert.match(hub, /activeCustomization\.nameOverrides\[app\.id\]/);
  assert.match(hub, /aria-label="Freunde öffnen"/);
  assert.match(hub, /to="\/profile"\s+hash="profile-training"/);
  assert.match(hub, /aria-label="Profil und Einstellungen öffnen"/);
  assert.match(hub, /avatarUrl\s*\?/);
});

test("home customization stays account-local and exposes accessible mobile controls", () => {
  assert.match(hub, /loadHomeAppCustomization\(window\.localStorage, user\.id\)/);
  assert.match(hub, /saveHomeAppCustomization\(window\.localStorage, user\.id, settings\)/);
  assert.match(hub, /customizationState\.userId === user\.id/);
  assert.match(customizationDialog, /<DialogTitle>Startseite anpassen<\/DialogTitle>/);
  assert.match(customizationDialog, /id=\{`home-app-name-\$\{app\.id\}`\}/);
  assert.match(customizationDialog, /nach oben verschieben/);
  assert.match(customizationDialog, /nach unten verschieben/);
  assert.match(customizationDialog, /className="h-11 w-11"/);
  assert.match(customizationDialog, /Änderungen\s+bleiben lokal auf diesem Konto und Gerät/);
  assert.doesNotMatch(customizationDialog, /fetch\(|supabase/i);
});

test("search stays a labeled header action and Alo tools are a square app-grid tile", () => {
  const header = hub.slice(hub.indexOf("<header"), hub.indexOf("</header>"));
  assert.match(header, /aria-label="Überall suchen"/);
  assert.match(header, /<Search className/);
  assert.match(header, /detail: "search"/);
  assert.doesNotMatch(header, />\s*Überall suchen\s*</);
  assert.match(
    hub,
    /id: "tools", title: "Alo-Werkzeuge", artwork: "tools", kind: "route", to: "\/tools"/,
  );
  assert.match(hub, /to=\{app\.to\}[\s\S]*?title=\{title\}[\s\S]*?artwork=\{app\.artwork\}/);
  assert.doesNotMatch(hub, /alo-tablet-home-tools|alo-btn[^\n]*w-full/);
  const toolsEntryStart = hub.indexOf('id: "tools"');
  assert.notEqual(toolsEntryStart, -1);
  assert.doesNotMatch(hub.slice(toolsEntryStart, toolsEntryStart + 120), /detail: "search"/);
});

test("the other-areas app tile navigates to its own page and no longer expands inline", () => {
  assert.match(hub, /id: "areas",[\s\S]*?title: "Weitere Bereiche",[\s\S]*?to: "\/areas"/);
  assert.match(
    hub,
    /ariaLabel=\{\s*app\.id === "areas" \? `\$\{title\} öffnen \(\$\{HOME_OTHER_AREAS\.length\}\)`/,
  );
  assert.doesNotMatch(hub, /moreAreasOpen|more-areas-panel|MORE_AREAS\.map/);
});

test("the Training & Gym app tile opens the existing training and partner overview", () => {
  assert.match(
    hub,
    /id: "training", title: "Trainingsübersicht & Gym", artwork: "training", kind: "training"/,
  );
  assert.match(hub, /app\.kind === "training"[\s\S]*?onClick=\{onOpenTrainingOverview\}/);
  assert.match(home, /onOpenTrainingOverview=\{openTrainingOverview\}/);
  assert.match(home, /overview\.open = true/);
  assert.match(home, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  const trainingSection = home.slice(home.indexOf('id="training-overview"'));
  assert.match(trainingSection, /<GymPartnerPanel \/>/);
  assert.match(
    trainingSection,
    /<DashboardGrid userId=\{userId\} renderWidget=\{renderWidget\} \/>/,
  );
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

test("tablet Home keeps the narrow canvas and four-icon row without a visible closed training card", () => {
  assert.match(home, /max-w-\[32rem\]/);
  assert.match(homeStyles, /main\.alo-tablet-home-page\s*\{\s*max-width:\s*32rem;/);
  assert.match(homeStyles, /\.alo-tablet-home-apps\s*\{\s*grid-template-columns:\s*repeat\(4,/);
  assert.match(
    homeStyles,
    /\.alo-tablet-home-page #training-overview\s*\{[\s\S]*?max-width:\s*32rem;/,
  );
  const detailsStart = home.lastIndexOf("<details", home.indexOf('id="training-overview"'));
  const trainingDetails = home.slice(detailsStart);
  const summary = trainingDetails.slice(
    trainingDetails.indexOf("<summary"),
    trainingDetails.indexOf("</summary>"),
  );
  assert.match(trainingDetails, /<details\s+className="group"\s+id="training-overview"/);
  assert.match(summary, /className="sr-only[^"]*focus:not-sr-only/);
  assert.doesNotMatch(
    trainingDetails.slice(0, trainingDetails.indexOf("<summary")),
    /border-|bg-card|shadow/,
  );
});

test("the bottom Mira launcher is a small round icon and still opens the existing dialog", () => {
  const launcherStart = home.indexOf("function MiraOverlayLauncher");
  const launcherEnd = home.indexOf("type HubArtworkKind", launcherStart);
  const launcher = home.slice(launcherStart, launcherEnd);
  const buttonStart = launcher.indexOf('className="alo-mira-home-launcher-button"');
  const button = launcher.slice(buttonStart, launcher.indexOf("</button>", buttonStart));

  assert.match(button, /aria-label="Mira öffnen und eine Frage stellen"/);
  assert.match(button, /aria-haspopup="dialog"/);
  assert.match(button, /aria-expanded=\{open\}/);
  assert.match(button, /handleOpenChange\(true\)/);
  assert.match(button, /<MiraSpark\s*\/>/);
  assert.doesNotMatch(button, /Frag Mira|<Mic|ArrowUpRight/);
  assert.match(
    miraHomeStyles,
    /\.alo-mira-home-launcher\s*\{[\s\S]*?bottom:\s*calc\(env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*1rem\)/,
  );
  assert.match(
    miraHomeStyles,
    /\.alo-mira-home-launcher-button\s*\{[\s\S]*?width:\s*3\.5rem;[\s\S]*?height:\s*3\.5rem;[\s\S]*?border-radius:\s*50%/,
  );
});

test("the Home exposes two separate game icons only after a server-confirmed Admin check", () => {
  assert.match(home, /getAdminAreaAccess\(\)/);
  assert.match(
    hub,
    /\.\.\.\(canSeeAdmin\s*\?\s*\[[\s\S]*?id: "grid-defense"[\s\S]*?game: "grid-defense"[\s\S]*?id: "kupferkern"[\s\S]*?game: "kupferkern"[\s\S]*?\]\s*:\s*\[\]\)/,
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
  assert.match(artwork, /kind === "tools"/);
  assert.doesNotMatch(artwork, /kind === "adventure"/);

  const trainingSection = home.slice(home.indexOf('id="training-overview"'));
  assert.match(trainingSection, /<summary[\s\S]*?Trainingsübersicht & Gym-Partner/);
  assert.match(trainingSection, /<GymPartnerPanel \/>/);
  assert.match(
    trainingSection,
    /<DashboardGrid userId=\{userId\} renderWidget=\{renderWidget\} \/>/,
  );
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
    ["/exercises", "exercises.tsx"],
    ["/programs", "programs.tsx"],
    ["/calisthenics", "calisthenics.tsx"],
    ["/run", "run.tsx"],
    ["/season", "season.tsx"],
    ["/battle", "battle.index.tsx"],
    ["/battle-league", "battle-league.tsx"],
    ["/leaderboard", "leaderboard.tsx"],
    ["/clubs", "clubs.tsx"],
    ["/alarm", "alarm.tsx"],
  ] as const) {
    assert.ok(existsSync(resolve(process.cwd(), "src/routes/_authenticated", routeFile)));
    assert.ok(homeMenus.includes(`to: "${destination}"`), `menu should link to ${destination}`);
  }
  assert.match(
    hub,
    /id: "tools", title: "Alo-Werkzeuge", artwork: "tools", kind: "route", to: "\/tools"/,
  );
  assert.doesNotMatch(hub, /detail: "menu"/);
  assert.match(hub, /aria-label="Überall suchen"/);
  assert.match(hub, /detail: "search"/);
  assert.match(hub, /id: "areas",[\s\S]*?to: "\/areas"/);
  assert.doesNotMatch(hub, /to="\/marketplace"|id: "marketplace"/);
});

test("every authenticated section exposes a clearly named route to the Alo home hub", () => {
  const homeSources = [
    ["Mira", "src/components/mira/SuperAiPage.tsx", /aria-label="Zur Alo-Startseite"/],
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

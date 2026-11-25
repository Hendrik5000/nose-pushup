import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("authenticated pages provide a keyboard skip link and focus destination", () => {
  const shell = read("routes/_authenticated/route.tsx");
  const css = read("styles.css");
  assert.match(shell, /className="alo-skip-link" href="#alo-main-content"/);
  assert.match(shell, /id="alo-main-content" tabIndex=\{-1\}/);
  assert.match(css, /\.alo-skip-link:focus/);
});

test("the Alo page sidebar becomes a drawer before tablet navigation crowds the page", () => {
  const sidebar = read("components/alo/AloPageSidebar.tsx");
  const genericSidebar = read("components/ui/sidebar.tsx");
  const hook = read("hooks/use-mobile.tsx");
  const navigationCss = read("alo-sitewide-redesign.css");
  assert.match(sidebar, /mobileBreakpoint=\{1024\}/);
  assert.match(genericSidebar, /mobileBreakpoint = 768/);
  assert.match(genericSidebar, /useIsMobile\(mobileBreakpoint\)/);
  assert.match(hook, /breakpoint = MOBILE_BREAKPOINT/);
  assert.match(navigationCss, /max-width: 1023px/);
  assert.match(navigationCss, /max-width: 480px/);
  assert.match(navigationCss, /alo-context-tab-item \.homebar-icon/);
});

test("login forms use German validation and large enough password toggles", () => {
  const auth = read("routes/auth.tsx");
  assert.equal((auth.match(/noValidate className="space-y-3"/g) ?? []).length, 2);
  assert.match(auth, /Bitte gib deine E-Mail-Adresse ein\./);
  assert.match(auth, /Bitte gib dein Passwort ein\./);
  assert.equal((auth.match(/min-h-11 w-11 place-items-center/g) ?? []).length, 2);
});

test("training start actions appear before optional counting controls and partner content", () => {
  const training = read("components/TrainingDashboard.tsx");
  const mobileCss = read("alo-mobile.css");
  const sportStart = training.indexOf(
    'className="mt-4 flex min-h-12 w-full items-center justify-center gap-2',
  );
  const sportModes = training.indexOf('className="sport-counting-group"');
  const classicStart = training.indexOf(
    'className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary',
  );
  const classicModes = training.indexOf(
    'className="alo-counting-options mt-3 grid grid-cols-3 gap-2"',
  );
  assert.ok(sportStart >= 0 && sportStart < sportModes);
  assert.ok(classicStart >= 0 && classicStart < classicModes);
  assert.ok(
    training.indexOf("<GymPartnerPanel />") >
      training.indexOf('aria-labelledby="today-plan-title"'),
  );
  assert.match(training, /Trainingsplan · heute/);
  assert.doesNotMatch(training, /Dein Start heute · \{recommendation\.title\}/);
  assert.match(mobileCss, /\.training-hero > a \{\s*order: 1;/);
  assert.match(
    mobileCss,
    /\.training-hero > \.alo-counting-select \{\s*display: flex;\s*order: 2;/,
  );
  assert.match(mobileCss, /\.training-hero > \.alo-counting-options \{\s*order: 2;/);
});

test("narrow health context tabs avoid clipping and preserve accessible labels", () => {
  const nav = read("components/TopNav.tsx");
  const css = read("alo-sitewide-redesign.css");
  assert.match(
    nav,
    /if \(pathname === "\/health"\)[\s\S]*?id: "health"[\s\S]*?tab\("entry", "Erfassen"/,
  );
  assert.match(nav, /<span>\{item\.label\}<\/span>/);
  assert.match(
    nav,
    /document\.documentElement\.dataset\.contextNavigation = String\(contextVisible\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 480px\) \{\s*html\[data-context-navigation="true"\] \.app-homebar\.alo-context-tabbar \{\s*inset-inline: 0\.35rem !important;\s*width: calc\(100% - 0\.7rem\);/,
  );
  assert.match(
    css,
    /html\[data-context-navigation="true"\] \.alo-context-tab-item \{\s*flex: 1 1 0;\s*min-width: 0;/,
  );
  assert.match(
    css,
    /html\[data-context-navigation="true"\] \.alo-context-tab-item > :is\(a, button\) > span \{\s*position: absolute;\s*width: 1px;[\s\S]*?clip: rect\(0, 0, 0, 0\);/,
  );
  assert.match(
    css,
    /html\[data-context-navigation="true"\] \.alo-context-tab-item \.homebar-icon \{\s*width: 1\.2rem;\s*height: 1\.2rem;/,
  );
});

test("confirmed mixed-language labels and tiny controls are corrected", () => {
  const exercises = read("routes/_authenticated/exercises.tsx");
  const cali = read("components/CaliSkillTree.tsx");
  const repository = read("components/mira/MiraGithubRepository.tsx");
  const chat = read("components/chat/LocalChatShell.tsx");
  const topNav = read("components/TopNav.tsx");
  const mira = read("components/mira/SuperAiPage.tsx");
  const communityCss = read("community-reference.css");
  assert.match(exercises, /touch: "Berührung"/);
  assert.match(exercises, /Bestwert/);
  assert.match(exercises, /Freischaltregeln/);
  assert.doesNotMatch(exercises, /Progression System|Progression Gates|Best:/);
  assert.equal((exercises.match(/<span className="[^"]*text-xs[^"]*">\s*NEU/g) ?? []).length, 2);
  assert.match(cali, /Bestwert/);
  assert.doesNotMatch(cali, /Best:/);
  assert.match(repository, /GitHub-Anfrage mit Mira/);
  assert.doesNotMatch(repository, /Repository-Aufgabe für Mira/);
  const githubDisclosure = repository.match(/<details\b([^>]*)>([\s\S]*?)<\/details>/);
  assert.ok(githubDisclosure);
  assert.doesNotMatch(githubDisclosure[1] ?? "", /\bopen\b/);
  assert.match(
    githubDisclosure[2] ?? "",
    /<summary[^>]*>[\s\S]*?Optionale GitHub-Repository-Funktion/,
  );
  assert.match(githubDisclosure[2] ?? "", /\{panel\}/);
  assert.match(repository, /const panel = \([\s\S]*?id="mira-github-prompt"/);
  assert.match(repository, /if \(!consented\) return;/);
  assert.match(topNav, /tab\("export", "Exportieren", ClipboardList/);
  assert.match(mira, /Chat exportieren/);
  assert.match(chat, /Online · Cloud/);
  assert.doesNotMatch(chat, /Online · Supabase/);
  assert.match(chat, /Chat exportieren/);
  assert.match(chat, /className="community-new-chat min-h-11 min-w-11"/);
  assert.match(
    communityCss,
    /html\[data-design-style="performance"\] \.community-mobile-list \.community-new-chat \{\s*min-width: 44px;\s*min-height: 44px;/,
  );
});

test("home launcher labels stay at least 12px in narrow and fullscreen layouts", () => {
  const home = read("routes/_authenticated/index.tsx");
  const css = read("styles.css");
  assert.equal(
    (home.match(/max-w-full text-xs font-medium leading-tight text-foreground/g) ?? []).length,
    3,
  );
  assert.match(
    css,
    /@media \(max-width: 380px\)[\s\S]*?\.alo-oneui9-home \.alo-tablet-home-apps :is\(a, button\) > span:last-child \{\s*font-size: 0\.75rem;/,
  );
  assert.match(css, /font-size: clamp\(0\.75rem, 1\.45vh, 0\.78rem\);/);
  assert.match(
    css,
    /html\[data-design-style="hig"\] \.alo-tablet-home-apps > :is\(a, button\) > span:last-child \{\s*font-size: 0\.75rem;/,
  );
});

test("exercise routes use the shared, large Alo home navigation", () => {
  const exercises = read("routes/_authenticated/exercises.tsx");
  assert.equal((exercises.match(/<AloHomeLink \/>/g) ?? []).length, 2);
  assert.doesNotMatch(exercises, /← Startseite|className="sport-back-link"/);
});

test("workout loading and root document fallback are useful and localized", () => {
  const workout = read("routes/_authenticated/workout.$exerciseId.tsx");
  const root = read("routes/__root.tsx");
  assert.match(workout, /Übung und Trainingsdaten werden geladen/);
  assert.doesNotMatch(workout, /"Lade…"/);
  assert.match(root, /\{ title: "Alo" \}/);
  assert.doesNotMatch(root, /All in one/);
});

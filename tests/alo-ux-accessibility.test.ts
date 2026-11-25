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
  const sportStart = training.indexOf(
    'className="mt-4 flex min-h-12 w-full items-center justify-center gap-2',
  );
  const sportModes = training.indexOf('className="sport-counting-group"');
  const classicStart = training.indexOf(
    'className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary',
  );
  const classicModes = training.indexOf('className="mt-3 grid grid-cols-3 gap-2"');
  assert.ok(sportStart >= 0 && sportStart < sportModes);
  assert.ok(classicStart >= 0 && classicStart < classicModes);
  assert.ok(
    training.indexOf("<GymPartnerPanel />") >
      training.indexOf('aria-labelledby="today-plan-title"'),
  );
  assert.match(training, /Trainingsplan · heute/);
  assert.doesNotMatch(training, /Dein Start heute · \{recommendation\.title\}/);
});

test("the zoom-equivalent narrow health navigation can fit all tabs while retaining labels", () => {
  const nav = read("components/TopNav.tsx");
  const css = read("alo-sitewide-redesign.css");
  const healthCss = read("health-reference.css");
  assert.match(nav, /<span>\{item\.label\}<\/span>/);
  assert.match(css, /max-width: 480px[\s\S]*?flex: 1 1 0[\s\S]*?width: 1px/);
  assert.match(healthCss, /max-width: 480px[\s\S]*?min-width: 2\.75rem[\s\S]*?flex: 1 1 0/);
});

test("confirmed mixed-language labels and tiny controls are corrected", () => {
  const exercises = read("routes/_authenticated/exercises.tsx");
  const cali = read("components/CaliSkillTree.tsx");
  const repository = read("components/mira/MiraGithubRepository.tsx");
  const chat = read("components/chat/LocalChatShell.tsx");
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
  assert.match(chat, /Online · Supabase/);
  assert.match(chat, /Chat exportieren/);
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
});

test("workout loading and root document fallback are useful and localized", () => {
  const workout = read("routes/_authenticated/workout.$exerciseId.tsx");
  const root = read("routes/__root.tsx");
  assert.match(workout, /Übung und Trainingsdaten werden geladen/);
  assert.doesNotMatch(workout, /"Lade…"/);
  assert.match(root, /\{ title: "Alo" \}/);
  assert.doesNotMatch(root, /All in one/);
});

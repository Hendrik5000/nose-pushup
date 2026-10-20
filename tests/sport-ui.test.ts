import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SportPageIntro, SportSectionLabel } from "../src/components/SportPageIntro";
import { DESIGN_STYLES, isDesignStyleId } from "../src/lib/design-style";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("classic and every previous design remain selectable alongside the redesigned performance UI", () => {
  assert.equal(DESIGN_STYLES.find((style) => style.id === "soft")?.label, "Klassisch");
  for (const id of [
    "soft",
    "compact",
    "editorial",
    "studio",
    "performance",
    "legacy-performance",
  ]) {
    assert.ok(isDesignStyleId(id));
  }
  const oldStyles = read("styles.css");
  assert.match(oldStyles, /\[data-design-style="legacy-performance"\]/);
  assert.match(oldStyles, /html\[data-design-style="legacy-performance"\] \.training-hero/);
  assert.match(
    oldStyles,
    /html\[data-design-style="legacy-performance"\].*\[data-navigation-layout="floating"\]/,
  );
});

test("new page structures are shared across training, health, community, account and public pages", () => {
  const pages = [
    "_authenticated/exercises.tsx",
    "_authenticated/programs.tsx",
    "_authenticated/calisthenics.tsx",
    "_authenticated/run.tsx",
    "_authenticated/workout.$exerciseId.tsx",
    "_authenticated/cali-workout.$skillId.tsx",
    "_authenticated/battle.index.tsx",
    "_authenticated/battle.$id.tsx",
    "_authenticated/battle-league.tsx",
    "_authenticated/clubs.tsx",
    "_authenticated/leaderboard.tsx",
    "_authenticated/season.tsx",
    "_authenticated/ai.tsx",
    "_authenticated/health.tsx",
    "_authenticated/profile-page-impl.tsx",
    "auth.tsx",
    "u.$slug.tsx",
  ];
  for (const page of pages) {
    const source = read(`routes/${page}`);
    assert.match(source, /SportPageIntro/, `${page}: must use the new structural introduction`);
    assert.match(source, /classic-only/, `${page}: must preserve the original presentation`);
  }
  assert.match(read("components/chat/LocalChatShell.tsx"), /sport-/);
  assert.match(read("routes/_authenticated/coach.tsx"), /<SuperAiPage \/>/);
  assert.match(read("routes/_authenticated/index.tsx"), /training-progress/);
  assert.match(read("routes/_authenticated/index.tsx"), /sport-shortcuts/);
});

test("new and old markup are mutually exclusive without rewriting saved appearance or widget choices", () => {
  const css = read("sport.css");
  assert.match(
    css,
    /html:not\(\[data-design-style="performance"\]\) \.sport-only\s*\{\s*display:\s*none\s*!important/,
  );
  assert.match(
    css,
    /html\[data-design-style="performance"\] \.classic-only\s*\{\s*display:\s*none\s*!important/,
  );
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-width:\s*767px/);
  const styleStorage = read("lib/design-style.ts");
  assert.doesNotMatch(
    styleStorage,
    /removeItem|clear\(|np-dashboard|np-theme|np-navigation-layout/,
  );
  const root = read("routes/__root.tsx");
  assert.ok(root.indexOf("href: sportCss") > root.indexOf("href: appCss"));
});

test("performance home puts today's workout before status metrics and keeps widget sizing responsive", () => {
  const home = read("routes/_authenticated/index.tsx");
  assert.match(home, /sport-dashboard-title">Heute trainieren/);
  assert.equal((home.match(/<PlanGoalNote/g) ?? []).length, 2);
  assert.match(
    home,
    /Dieser Startplan:[\s\S]*?ein Schritt zum Tagesziel[\s\S]*?nicht für eine einzelne Einheit/,
  );
  assert.match(home, /Nasenmodus: Tippe den Zähler mit der Nase an/);
  assert.doesNotMatch(home, /aria-label="Dein Trainingsstatus"|Fortschritt öffnen/);
  assert.equal((home.match(/aria-label="Trainingsfortschritt"/g) ?? []).length, 1);
  assert.match(
    home,
    /todayProgress.measured \? `\$\{todayReps\} \/ \$\{goal\}` : todayProgress.label/,
  );
  assert.ok(
    home.indexOf('className="alo-home-intro"') >
      home.indexOf('className="classic-only training-hero'),
    "Alo area cards should follow the classic and performance start plans",
  );
  assert.ok(
    home.indexOf('className="sport-only training-hero') <
      home.indexOf('className="sport-only sport-shortcuts'),
  );
  const statsWidget = home.slice(home.indexOf('case "statsRing"'), home.indexOf('case "reminder"'));
  assert.match(statsWidget, /Bestwert, Schritte & Level/);
  assert.doesNotMatch(statsWidget, /Wdh\. heute|Trainingsserie|Tagesziel/);
  const hub = home.slice(home.indexOf('aria-label="Deine Alo-Bereiche"'));
  assert.match(hub, /<h2 className="mt-1 text-lg font-bold">Liegestütztraining<\/h2>/);
  assert.match(hub, /Deine Gespräche bleiben lokal auf diesem Gerät/);
  assert.doesNotMatch(hub, /Verbinde dich mit Menschen|Chat-Räumen/);
  assert.match(home, /className="sport-counting-group" role="group" aria-label="Zählmethode"/);

  const dashboard = read("components/dashboard/DashboardGrid.tsx");
  assert.match(dashboard, /data-widget-size=\{item\.size\}/);

  const styles = read("sport.css");
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(styles, /@media \(min-width: 720px\)/);
  assert.match(styles, /@media \(min-width: 1200px\)/);
  assert.match(styles, /grid-column: span 3 !important/);
  assert.match(read("routes/_authenticated/route.tsx"), /<TopNav \/>/);
  const install = read("routes/__root.tsx");
  assert.match(install, /aria-label="App installieren"[\s\S]*border-border/);
  const installHint = install.slice(
    install.indexOf('aria-label="App installieren"'),
    install.indexOf("<OfflineBanner />"),
  );
  assert.doesNotMatch(installHint, /fixed|absolute|z-40/);
  assert.match(installHint, /<details[\s\S]*<summary[\s\S]*min-h-11/);
  assert.ok(install.indexOf("<Outlet />") < install.indexOf('aria-label="App installieren"'));
  assert.match(install, /sessionStorage.getItem\("alo-install-hint-dismissed"\)/);
  assert.match(install, /sessionStorage.setItem\("alo-install-hint-dismissed", "1"\)/);
  assert.match(install, /aria-label="Installationshinweis schließen"/);
});

test("performance AI coach has focused subviews, task-first entry points and keeps the classic view", () => {
  const ai = read("routes/_authenticated/ai.tsx");
  assert.match(ai, /<DesignView variant="classic">/);
  assert.match(ai, /<DesignView variant="sport">/);
  assert.match(ai, /Mira-Bereiche/);
  assert.match(ai, /Ideen entwickeln/);
  assert.match(ai, /Mira fragen/);
  assert.match(ai, /Schnelle Einstiege/);
  assert.match(ai, /Weitere Aufgaben/);
  assert.match(ai, /Deine Chats/);
  assert.match(ai, /Chats durchsuchen/);
  assert.match(ai, /Mit Trainingsplan/);
  assert.match(ai, /filteredSessions\.map/);
  assert.match(ai, /AiProviderSettings\s+onSaved=/);
  assert.match(ai, /sport-chat-stage/);
  assert.match(ai, /sport-chat-composer/);
  assert.match(ai, /sport-ai-chat-mode/);

  const styles = read("sport.css");
  assert.match(styles, /sport-ai-hub/);
  assert.match(styles, /sport-ai-primary-actions/);
  assert.match(styles, /sport-ai-chat-grid/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /font-size: 0\.7rem/);
  assert.match(styles, /sport-ai-chat-main[\s\S]*max-height: calc\(100dvh - 12rem\)/);
  assert.match(styles, /sport-chat-composer[\s\S]*position: sticky/);
  assert.match(styles, /sport-ai-chat-mode[\s\S]*height: min\(50dvh, 26rem\)/);
});

test("sport page components render semantic content and permit real data actions", () => {
  const intro = renderToStaticMarkup(
    createElement(SportPageIntro, {
      eyebrow: "Training",
      title: "Dein Fokus",
      description: "Deine echte Trainingsübersicht.",
      children: createElement("a", { href: "/exercises" }, "Übungen öffnen"),
    }),
  );
  assert.match(intro, /<h1>Dein Fokus<\/h1>/);
  assert.match(intro, /href="\/exercises"/);
  assert.match(intro, /sport-only/);
  const section = renderToStaticMarkup(
    createElement(SportSectionLabel, { number: "01", children: "Fortschritt" }),
  );
  assert.match(section, /<h2>Fortschritt<\/h2>/);
});

test("shared sports menu exposes every existing feature group", () => {
  const menu = read("components/SportAppHeader.tsx");
  for (const route of [
    "/exercises",
    "/programs",
    "/calisthenics",
    "/run",
    "/health",
    "/ai",
    "/season",
    "/battle",
    "/battle-league",
    "/leaderboard",
    "/clubs",
    "/chat",
    "/profile",
  ]) {
    assert.ok(menu.includes(`"${route}"`), `missing ${route}`);
  }
  assert.match(menu, /aria-expanded/);
  assert.match(menu, /Escape/);
});

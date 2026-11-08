import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const health = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/health.tsx"), "utf8");
const home = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/index.tsx"), "utf8");
const menus = readFileSync(resolve(process.cwd(), "src/lib/home-app-menus.ts"), "utf8");
const healthStyles = readFileSync(resolve(process.cwd(), "src/health-reference.css"), "utf8");

const occurrences = (text: string, value: string) => text.split(value).length - 1;

test("both Health designs expose the same clear categories and reuse existing health modules", () => {
  for (const section of [
    "health-today",
    "health-activity",
    "health-nutrition",
    "health-recovery",
    "health-body",
    "health-training",
    "health-history",
    "health-sources",
  ]) {
    assert.ok(
      occurrences(health, `href="#${section}"`) >= 2,
      `both visual designs should link to ${section}`,
    );
  }

  for (const module of [
    "<MealPhotoCard />",
    "<WaterTracker key={user.id} userId={user.id} />",
    "<SleepDebtCard",
    "<ReadinessCard",
    "<RecoveryCalendar",
    "<MoodCheckin key={user.id} userId={user.id} />",
    "<WeightTrendCard",
    "<WorkoutHistory",
    "<HealthTrainingLinks />",
  ]) {
    assert.equal(occurrences(health, module), 2, `${module} should appear once per design`);
  }

  assert.match(health, /Wasser wird lokal getrennt pro Alo-Konto/);
  assert.match(health, /Stimmung bleibt lokal und ist von anderen Alo-Konten/);
  assert.match(health, /label="Ø aktive kcal \(7T\)"/);
  assert.match(health, /id="health-recovery"[\s\S]*?label="Ø Schlaf \(7T\)"/);
  assert.match(health, /Google Health Connect/);
  assert.match(health, /<SmartwatchPanel \/>/);
});

test("mobile Health navigation wraps all categories instead of hiding them in a scroll rail", () => {
  const performanceNav = healthStyles.match(
    /@media \(max-width: 767px\) \{\s*(html\[data-design-style="performance"\][\s\S]*?\.health-category-nav \{[\s\S]*?\})/,
  );
  const classicNav = healthStyles.match(
    /html:not\(\[data-design-style="performance"\]\) \.health-classic-dashboard \.health-classic-category-nav \{([\s\S]*?)\}/,
  );

  assert.ok(performanceNav, "performance layout should have a mobile navigation rule");
  assert.match(performanceNav[1], /flex-wrap: wrap;/);
  assert.match(performanceNav[1], /overflow: visible;/);
  assert.ok(classicNav, "classic layout should have a category navigation rule");
  assert.match(classicNav[1], /flex-wrap: wrap;/);
  assert.match(classicNav[1], /overflow-x: visible;/);
  assert.doesNotMatch(healthStyles, /health-category-nav::?-webkit-scrollbar\s*\{/);
  assert.doesNotMatch(healthStyles, /health-classic-category-nav::?-webkit-scrollbar\s*\{/);
});

test("Alo Health opens the Health hub while the exercise catalog remains separately reachable", () => {
  assert.match(
    home,
    /id: "health", title: "Alo Health", artwork: "health", kind: "route", to: "\/health"/,
  );
  assert.match(
    home,
    /case "briefing":[\s\S]*?return userId\s*\?[\s\S]*?<DailyBriefingCard\s+userId=\{userId\}/,
  );
  assert.match(
    home,
    /case "mood":\s+return userId \? wrap\(<MoodCheckin key=\{userId\} userId=\{userId\}/,
  );
  assert.match(
    home,
    /case "water":\s+return userId \? wrap\(<WaterTracker key=\{userId\} userId=\{userId\}/,
  );
  assert.match(menus, /to: "\/exercises",\s+label: "Übungen"/);
  assert.doesNotMatch(menus, /to: "\/health"/);
});

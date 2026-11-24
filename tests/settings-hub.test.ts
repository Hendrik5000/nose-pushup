import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  filterProfileSettingsGroups,
  PROFILE_SETTINGS_CATEGORIES,
} from "../src/lib/profile-settings";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const profile = read("routes/_authenticated/profile-page-impl.tsx");
const sidebar = read("components/alo/AloPageSidebar.tsx");
const categoryRow = read("components/settings/SettingsCategoryRow.tsx");
const input = read("components/ui/input.tsx");
const homeMenus = read("components/HomeAppMenuLayout.tsx");
const topNav = read("components/TopNav.tsx");

test("each of the ten top-level settings categories has working existing controls", () => {
  const contentCases = [
    'case "profile":',
    'case "apps":',
    'case "appearance":',
    'case "training":',
    'case "community":',
    'case "notifications":',
    'case "controls":',
    'case "privacy":',
    'case "history":',
    'case "support":',
  ];
  assert.equal(PROFILE_SETTINGS_CATEGORIES.length, 10);
  for (const contentCase of contentCases)
    assert.ok(profile.includes(contentCase), `missing ${contentCase}`);
});

test("settings search filters only existing category titles and subtitles locally", () => {
  assert.deepEqual(
    filterProfileSettingsGroups("  MIRA ").flatMap((group) => group.categories),
    ["apps"],
  );
  assert.deepEqual(
    filterProfileSettingsGroups("DATENSCHUTZ").flatMap((group) => group.categories),
    ["privacy"],
  );
  assert.deepEqual(filterProfileSettingsGroups("kein Treffer"), []);
  assert.equal(
    filterProfileSettingsGroups(" ").flatMap((group) => group.categories).length,
    PROFILE_SETTINGS_CATEGORIES.length,
  );
});

test("settings search is labeled, theme-token based, and responsive across both Alo designs", () => {
  assert.equal((profile.match(/<SettingsCategoryGroups\b/g) ?? []).length, 2);
  assert.match(profile, /<Input[\s\S]*?type="search"/);
  assert.match(profile, /htmlFor=\{searchId\}/);
  assert.match(profile, /Einstellungsbereiche durchsuchen/);
  assert.match(profile, /aria-describedby=\{`\$\{searchId\}-hint`\}/);
  assert.match(profile, /sm:max-w-xl/);
  assert.match(profile, /role="status"/);
  assert.match(input, /border-input/);
  assert.match(input, /placeholder:text-muted-foreground/);
  assert.match(input, /focus-visible:ring-1 focus-visible:ring-ring/);
});

test("category links use dedicated routes; the settings hub is not a second accordion UI", () => {
  assert.match(categoryRow, /to="\/settings\/\$category"/);
  assert.match(profile, /<SettingsCategoryScreen/);
  assert.doesNotMatch(profile, /<SettingsSection\b/);
  assert.match(profile, /aria-label="Einstellungsbereiche"/);
});

test("menu accent appears on navigation and app-menu surfaces while the app theme remains separate", () => {
  assert.match(profile, /<MenuAccentPicker \/>/);
  assert.match(sidebar, /settings:\s*\{/);
  assert.match(sidebar, /href: "\/settings\/apps"/);
  assert.match(homeMenus, /data-alo-menu-surface="true"/);
  assert.match(topNav, /label: "Einstellungen"/);
  assert.match(
    profile,
    /<ThemePicker profileId=\{profile\?\.id\} initialTheme=\{profile\?\.theme \?\? null\} \/>/,
  );
});

test("the hub preserves the existing main profile card and adapts to both Alo designs", () => {
  assert.match(profile, /<DesignView variant="classic">/);
  assert.match(profile, /<DesignView variant="sport">/);
  assert.equal((profile.match(/<ProfileSummaryCard/g) ?? []).length, 2);
  assert.match(profile, /aria-label="Athletenprofil"/);
  assert.match(profile, /levelProgress\(profile\?\.xp \?\? 0\)/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PROFILE_SETTINGS_CATEGORIES, PROFILE_SETTINGS_GROUPS } from "../src/lib/profile-settings";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const profile = read("routes/_authenticated/profile-page-impl.tsx");
const settingsRoute = read("routes/_authenticated/settings.$category.tsx");
const categoryRow = read("components/settings/SettingsCategoryRow.tsx");
const profileRoute = read("routes/_authenticated/profile.tsx");

const expectedCategories = [
  "profile",
  "apps",
  "appearance",
  "training",
  "community",
  "notifications",
  "controls",
  "privacy",
  "history",
  "support",
];

test("settings hub has ten genuine, grouped categories with allowlisted destinations", () => {
  assert.deepEqual(
    PROFILE_SETTINGS_CATEGORIES.map(({ id }) => id),
    expectedCategories,
  );
  assert.equal(PROFILE_SETTINGS_GROUPS.flatMap((group) => group.categories).length, 10);
  assert.match(profile, /aria-label="Einstellungsbereiche"/);
  assert.match(profile, /SettingsCategoryGroups/);
  assert.match(profile, /SettingsCategoryRow key=\{categoryId\} categoryId=\{categoryId\}/);
  assert.match(categoryRow, /to="\/settings\/\$category"/);
  assert.match(settingsRoute, /beforeLoad:[\s\S]*?isProfileSettingsCategory\(params\.category\)/);
  assert.match(settingsRoute, /return <ProfilePage sectionId=\{category\} \/>/);
});

test("choosing a settings category opens a dedicated page instead of expanding an accordion", () => {
  assert.match(profile, /<SettingsCategoryScreen subtitle=\{category\.subtitle\}>/);
  assert.doesNotMatch(profile, /<SettingsSection\b/);
  assert.doesNotMatch(categoryRow, /aria-expanded|onClick=\{\(\)\s*=>/);
  assert.match(profile, /to="\/profile"[\s\S]*?aria-label="Zurück zu Einstellungen"/);
  assert.match(profile, /data-settings-category-screen="true"/);
  const categoryScreen = profile.slice(
    profile.indexOf("function SettingsCategoryScreen"),
    profile.indexOf("function SettingsBlock"),
  );
  assert.doesNotMatch(categoryScreen, /<h2\b/);
  const categoryBlocks = profile.slice(
    profile.indexOf("function SettingsBlock"),
    profile.indexOf("type SettingsCategoryContentProps"),
  );
  assert.match(categoryBlocks, /<h2 className="text-sm font-bold">\{title\}<\/h2>/);
});

test("keeps the existing profile summary and real settings features available", () => {
  assert.equal((profile.match(/<ProfileSummaryCard/g) ?? []).length, 2);
  assert.equal((profile.match(/<SettingsCategoryGroups \/>/g) ?? []).length, 2);
  for (const component of [
    "<AppsSettingsList />",
    "<MenuAccentPicker />",
    "<ThemePicker profileId={profile?.id} initialTheme={profile?.theme ?? null} />",
    "<DesignStylePicker />",
    "<NavigationLayoutPicker />",
    "<CoachPanel",
    "<FriendsPanel userId={profile.id} />",
    "<BadgeGallery />",
    "<NotificationSettings />",
    "<PublicProfileSettings />",
    "<AloWebAppGuide />",
    "<ErrorReportsPanel />",
    "<BottomNav />",
  ]) {
    assert.ok(profile.includes(component), `existing settings feature is missing: ${component}`);
  }
  assert.match(profile, /aria-label="Athletenprofil"/);
  assert.match(profile, /Fortschritt zum nächsten Level/);
  assert.match(profile, /best_count: profile\.best_count \?\? 0/);
  assert.match(profile, /longest_streak: profile\.longest_streak \?\? 0/);
  assert.match(profileRoute, /<AloPageSidebar active="settings">/);
});

test("mobile category cards and settings controls retain large touch targets and readable inputs", () => {
  assert.match(categoryRow, /min-h-16/);
  assert.match(profile, /min-h-11 w-full/);
  assert.match(profile, /text-base outline-none/);
  assert.match(profile, /role="switch"/);
  assert.match(profile, /className=\{`settings-page-header/);
});

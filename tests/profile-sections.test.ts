import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const profile = readFileSync(
  new URL("../src/routes/_authenticated/profile-page-impl.tsx", import.meta.url),
  "utf8",
);
const settingsSection = readFileSync(
  new URL("../src/components/SettingsSection.tsx", import.meta.url),
  "utf8",
);

test("classic profile provides mobile-friendly shortcuts to key settings sections", () => {
  assert.match(profile, /<nav[\s\S]*?aria-label="Profilbereiche"[\s\S]*?overflow-x-auto/);
  assert.match(profile, /min-h-11 shrink-0/);
  for (const [label, href] of [
    ["Training", "#profile-training"],
    ["Darstellung", "#appearance"],
    ["App & Datenschutz", "#profile-app"],
    ["Verlauf", "#profile-history"],
  ]) {
    assert.ok(profile.includes(`["${label}", "${href}"]`), `missing shortcut: ${label}`);
  }
  for (const id of ["profile-training", "profile-app", "profile-history"]) {
    assert.ok(profile.includes(`id="${id}"`), `missing shortcut target: ${id}`);
  }
  assert.match(profile, /profileAppearance\s*\n\s*revealKey=/);
});

test("profile settings remain progressively disclosed and appearance options remain available", () => {
  assert.match(settingsSection, /aria-expanded=\{open\}/);
  assert.match(settingsSection, /onClick=\{\(\) => setOpen\(\(o\) => !o\)\}/);
  for (const component of [
    "<DesignStylePicker />",
    "<NavigationLayoutPicker />",
    "<ThemePicker profileId={profile?.id} initialTheme={profile?.theme ?? null} />",
    "<BadgeGallery />",
    "<NotificationSettings />",
    "<PublicProfileSettings />",
    "<ErrorReportsPanel />",
    "<BottomNav />",
  ]) {
    assert.ok(profile.includes(component), `existing profile feature was removed: ${component}`);
  }
  assert.match(profile, /eyebrow="DEIN TRAININGSPROFIL"/);
  assert.match(profile, /profileBest === null \? "Noch kein Bestwert" : profileBest/);
  assert.match(profile, /workouts\.length > 0 \? workouts\.length : "Noch keine Erfassung"/);
});

test("default sport profile groups its long settings page into discoverable sections", () => {
  for (const title of [
    "Konto & Fortschritt",
    "Training & Kontakte",
    "Profil & Darstellung",
    "App & Datenschutz",
    "Trainingsverlauf",
  ]) {
    assert.ok(profile.includes(`title="${title}"`));
  }
  assert.equal((profile.match(/aria-label="Profilbereiche"/g) ?? []).length, 2);
  assert.match(profile, /id="profile-account"/);
  assert.match(settingsSection, /aria-controls=\{contentId\}/);
  assert.match(settingsSection, /inert=\{!open\}/);
  assert.match(settingsSection, /\(open \|\| visited\) && children/);
});

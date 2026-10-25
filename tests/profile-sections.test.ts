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
const settingsStyles = readFileSync(new URL("../src/sport.css", import.meta.url), "utf8");

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

test("only the four large settings categories use prominent icons", () => {
  const titles = [
    "Konto & Fortschritt",
    "Training & Kontakte",
    "Profil & Darstellung",
    "App & Datenschutz",
  ];

  for (const title of titles) {
    const titleIndex = profile.indexOf(`title="${title}"`);
    const openingTagStart = profile.lastIndexOf("<SettingsSection", titleIndex);
    const openingTagEnd = profile.indexOf(">", titleIndex);
    assert.ok(openingTagStart >= 0 && openingTagEnd >= 0, `missing section: ${title}`);
    assert.match(profile.slice(openingTagStart, openingTagEnd + 1), /\bprominentIcon\b/);
  }

  assert.equal((profile.match(/\bprominentIcon\b/g) ?? []).length, titles.length);
});

test("settings groups show a clear category graphic in both design variants", () => {
  assert.match(settingsSection, /settings-section-icon-chip/);
  assert.match(settingsSection, /settings-section-emoji/);
  assert.match(settingsSection, /settings-section-icon-chip-prominent h-14 w-14/);
  assert.match(settingsSection, /prominentIcon \? "h-8 w-8" : "h-6 w-6"/);
  assert.match(settingsStyles, /\.settings-section-emoji\s*\{\s*display: inline-flex/);
  assert.match(settingsStyles, /\.settings-section-emoji-prominent\s*\{\s*font-size: 1\.6rem/);
  assert.match(settingsStyles, /\.settings-section-vector\s*\{\s*display: none/);
  assert.match(
    settingsStyles,
    /html\[data-design-style="performance"\] \.settings-section-emoji\s*\{\s*display: none/,
  );
  assert.match(
    settingsStyles,
    /html\[data-design-style="performance"\] \.settings-section-vector\s*\{\s*display: block/,
  );
  assert.match(settingsSection, /title\.includes\("Darstellung"\)[\s\S]*?\? Palette/);
  assert.match(settingsSection, /title\.includes\("Datenschutz"\)[\s\S]*?\? ShieldCheck/);
  assert.match(settingsSection, /title\.includes\("Verlauf"\)[\s\S]*?\? History/);
});

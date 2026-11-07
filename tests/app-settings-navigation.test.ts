import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APP_SETTINGS_ENTRIES,
  getAppSettingsEntry,
  isFullScreenAppSettingsId,
  resolveAppSettingsReturnTarget,
} from "../src/lib/app-settings";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const route = read("routes/_authenticated/settings.apps.$appId.tsx");
const settingsPage = read("components/settings/AppSettingsPage.tsx");
const settingsGear = read("components/settings/AppSettingsGear.tsx");
const appList = read("components/settings/AppsSettingsList.tsx");
const profile = read("routes/_authenticated/profile-page-impl.tsx");
const mira = read("components/mira/SuperAiPage.tsx");
const health = read("routes/_authenticated/health.tsx");

test("Apps settings lists only apps with real settings destinations", () => {
  assert.deepEqual(
    APP_SETTINGS_ENTRIES.map(({ id }) => id),
    ["mira", "health", "alarm"],
  );
  assert.equal(getAppSettingsEntry("mira")?.title, "Mira");
  assert.equal(getAppSettingsEntry("health")?.title, "Alo Health");
  assert.equal(getAppSettingsEntry("alarm")?.title, "Wecker");
  assert.equal(getAppSettingsEntry("nexus"), null);
  assert.equal(getAppSettingsEntry("marketplace"), null);
  assert.equal(getAppSettingsEntry("training"), null);
});

test("only Mira and Health receive new pages and invalid return destinations fail closed", () => {
  assert.equal(isFullScreenAppSettingsId("mira"), true);
  assert.equal(isFullScreenAppSettingsId("health"), true);
  assert.equal(isFullScreenAppSettingsId("alarm"), false);
  assert.equal(isFullScreenAppSettingsId("nexus"), false);
  assert.equal(resolveAppSettingsReturnTarget("mira", "/ai"), "/ai");
  assert.equal(resolveAppSettingsReturnTarget("health", "/health"), "/health");
  assert.equal(resolveAppSettingsReturnTarget("mira", "/health"), "/settings/apps");
  assert.equal(
    resolveAppSettingsReturnTarget("health", "https://example.invalid"),
    "/settings/apps",
  );
  assert.equal(resolveAppSettingsReturnTarget("mira", "javascript:alert(1)"), "/settings/apps");
});

test("Apps category opens dedicated app pages or the existing Wecker editor", () => {
  assert.match(appList, /aria-label="Apps mit eigenen Einstellungen"/);
  assert.match(appList, /to="\/settings\/apps\/\$appId"/);
  assert.match(appList, /search=\{\{ from: "\/settings\/apps" \}\}/);
  assert.match(appList, /to="\/alarm"/);
  assert.match(appList, /min-h-16/);
  assert.match(profile, /case "apps":[\s\S]*?<AppsSettingsList \/>/);
});

test("authenticated full-screen app settings reuse existing Mira and Health controls without duplicating global settings", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/settings\/apps\/\$appId"\)/);
  assert.match(route, /Route\.useRouteContext\(\)/);
  assert.match(route, /userId=\{user\.id\}/);
  assert.match(settingsPage, /<MiraAppSettingsControls userId=\{userId\} \/>/);
  assert.match(settingsPage, /<MiraContextControls userId=\{userId\} \/>/);
  assert.match(settingsPage, /<HealthConnectPanel \/>/);
  assert.match(settingsPage, /<SmartwatchPanel \/>/);
  assert.match(settingsPage, /titleRef\.current\?\.focus\(\)/);
  assert.match(settingsPage, /tabIndex=\{-1\}/);
  assert.match(settingsPage, /aria-label="Zur Alo-Startseite"/);
  assert.match(settingsPage, /<DesignView variant="classic">/);
  assert.match(settingsPage, /<DesignView variant="sport">/);
  assert.doesNotMatch(
    settingsPage,
    /ThemePicker|DesignStylePicker|dangerouslySetInnerHTML|\beval\(|<SettingsSection/,
  );
});

test("app gears preserve their caller and keep an accessible mobile touch target", () => {
  assert.match(settingsGear, /to="\/settings\/apps\/\$appId"/);
  assert.match(settingsGear, /search=\{\{ from: appId === "mira" \? "\/ai" : "\/health" \}\}/);
  assert.match(settingsGear, /min-h-11 min-w-11/);
  assert.match(settingsGear, /aria-label=\{`\$\{app\.title\}-Einstellungen öffnen`\}/);
  assert.match(mira, /<AppSettingsGear appId="mira"/);
  assert.match(health, /<AppSettingsGear appId="health"/);
  assert.match(mira, /<MiraRunwareTools[\s\S]*?open=\{runwareOpen\}/);
  assert.match(mira, /Runware · Text & Medien erweitern/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../src/components/GymPartnerPanel.tsx", import.meta.url),
  "utf8",
);

test("Gym panel scopes private in-memory state to the authenticated account", () => {
  assert.match(source, /!account\s*\?/);
  assert.match(source, /account\.guest\s*\?/);
  assert.match(source, /<GymAccountPanel key=\{account\.id\} userId=\{account\.id\} \/>/);
  assert.match(source, /next\.own\.userId !== userId/);
});

test("partner display is limited to explicitly shared aggregate stats", () => {
  assert.match(source, /snapshot\.partner\?\.sharing && snapshot\.partner\.stats/);
  assert.match(source, /<Stats \{\.\.\.snapshot\.partner\.stats\} \/>/);
  assert.doesNotMatch(source, /snapshot\.partner\.sets/);
  assert.match(source, /checked=\{snapshot\.own\.sharing\}/);
  assert.match(source, /setGymSharing\(snapshot\.id, share\)/);
});

test("set-level details and history are rendered only for the current user's own data", () => {
  assert.match(source, /snapshot\.own\.sets\.map\(/);
  assert.match(source, /getGymHistory\(\)/);
  assert.match(source, /Mein privater Gym-Verlauf/);
  assert.doesNotMatch(source, /partner\.sets|partner\.entries/);
});

test("gym UI does not persist partner or history data in browser storage", () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test("new auth events cannot be overwritten by a late initial account lookup", () => {
  assert.match(source, /let authEventReceived = false/);
  assert.match(source, /authEventReceived = true/);
  assert.ok(source.indexOf(".onAuthStateChange(") < source.indexOf(".getUser()"));
  assert.match(source, /if \(!authEventReceived\) apply\(data\.user\)/);
});

test("hidden or mismatched account data cannot leave create/join enabled", () => {
  assert.match(
    source,
    /if \(document\.hidden\) \{[\s\S]*?setSnapshot\(null\);\s*setLoaded\(false\)/,
  );
  assert.match(source, /next\.own\.userId !== userId[\s\S]*?setLoaded\(false\)/);
});

test("recording a set requires the second account to have joined", () => {
  assert.match(source, /if \(!snapshot \|\| snapshot\.status !== "active"\) return/);
  assert.match(source, /disabled=\{busy \|\| snapshot\.status !== "active"\}/);
});

test("attendance counts and exact visit dates have separate opt-in controls", () => {
  assert.match(source, /checked=\{snapshot\.own\.visitSharing\?\.counts \?\? false\}/);
  assert.match(source, /checked=\{snapshot\.own\.visitSharing\?\.days \?\? false\}/);
  assert.match(
    source,
    /snapshot\.partner\?\.visitSharing\?\.counts && snapshot\.partner\.visitStats/,
  );
  assert.match(source, /snapshot\.partner\?\.visitSharing\?\.days && snapshot\.partner\.visitDays/);
  assert.match(source, /Keine automatische Übergabe an Mira/);
});

test("new gym data is not wired to the automatic Mira context or tools", () => {
  for (const path of [
    "../src/lib/ai-context.ts",
    "../src/lib/super-ai-tools.ts",
    "../src/components/alo/MiraContextControls.tsx",
  ]) {
    const context = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(context, /gym_visits|gym_sets|gym_get_|gym-partner|gym-calendar/);
  }
  assert.doesNotMatch(source, /buildAppContext|miraSend|aiContext/);
});

test("Gym card is the first home content before date labels and today's plan", () => {
  const home = readFileSync(
    new URL("../src/routes/_authenticated/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /<main\b[^>]*>\s*<GymPartnerPanel \/>/);
  assert.equal((home.match(/<GymPartnerPanel \/>/g) ?? []).length, 1);
  assert.ok(
    home.indexOf("<GymPartnerPanel />") < home.indexOf('className="classic-only dashboard-header'),
  );
  assert.ok(
    home.indexOf("<GymPartnerPanel />") <
      home.indexOf('className="sport-only sport-dashboard-welcome"'),
  );
  assert.ok(home.indexOf("<GymPartnerPanel />") < home.indexOf('number="01">Dein Plan heute'));
});

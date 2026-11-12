import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const profile = read("routes/_authenticated/profile-page-impl.tsx");
const profileRoute = read("routes/_authenticated/profile.tsx");
const sidebar = read("components/alo/AloPageSidebar.tsx");
const topNav = read("components/TopNav.tsx");

test("settings hub has a top-left menu and the shared Alo sidebar includes direct app destinations", () => {
  assert.match(profile, /<AloPageSidebarTrigger \/>/);
  assert.match(profileRoute, /<AloPageSidebar active="settings">/);
  assert.match(sidebar, /export type AloPageSection = "mira" \| "nexus" \| "health" \| "settings"/);
  assert.match(sidebar, /settings:\s*\{[\s\S]*?Persönliche Einstellungen/);
  for (const [label, href] of [
    ["Einstellungen", "/profile"],
    ["Apps", "/settings/apps"],
    ["Mira", "/ai"],
    ["Nexus Chat", "/chat"],
    ["Alo Health", "/health"],
  ]) {
    assert.ok(sidebar.includes(`label: "${label}"`), `missing sidebar destination: ${label}`);
    assert.ok(sidebar.includes(`href: "${href}"`), `missing direct path: ${href}`);
  }
});

test("shared navigation labels the destination Einstellungen and hides duplicate global chrome on settings pages", () => {
  assert.match(topNav, /label: "Einstellungen", icon: Settings2/);
  assert.match(topNav, /pathname\.startsWith\("\/settings"\)/);
  assert.match(topNav, /pathname\.startsWith\("\/profile"\)/);
  assert.match(profile, /aria-label="Einstellungsbereiche"/);
});

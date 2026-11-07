import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_MENU_ACCENT,
  getMenuAccentColor,
  isMenuAccentId,
  MENU_ACCENTS,
} from "../src/lib/menu-accent";
import type { ThemeId } from "../src/lib/theme";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const root = read("routes/__root.tsx");
const theme = read("lib/theme.ts");
const picker = read("components/settings/MenuAccentPicker.tsx");
const styles = read("styles.css");
const sidebar = read("alo-page-sidebar.css");

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("menu accent is a four-choice, local-only preference independent from theme selection", () => {
  assert.equal(DEFAULT_MENU_ACCENT, "blue");
  assert.deepEqual(
    MENU_ACCENTS.map(({ id }) => id),
    ["blue", "purple", "green", "amber"],
  );
  assert.equal(isMenuAccentId("purple"), true);
  assert.equal(isMenuAccentId("red"), false);
  assert.equal(getMenuAccentColor("blue", "daylight"), "#1355a2");
  assert.equal(getMenuAccentColor("blue", "glacier"), "#7ccbff");
  assert.match(picker, /Wird nur lokal auf diesem Gerät gespeichert/);
  assert.match(picker, /applyMenuAccent\(id\)/);
});

test("each accent maintains at least 4.5:1 contrast on supported light and dark theme backgrounds", () => {
  const lightThemes: Array<[ThemeId, string]> = [
    ["daylight", "#f4f8ff"],
    ["sand", "#fbf4e8"],
    ["rose", "#fff4f7"],
  ];
  const darkBackgrounds = ["#000000", "#1c1c1e", "#071b14", "#081426", "#14181e"];
  for (const accent of MENU_ACCENTS) {
    for (const [, background] of lightThemes) {
      assert.ok(
        contrastRatio(accent.light, background) >= 4.5,
        `${accent.id} light contrast below 4.5:1 on ${background}`,
      );
    }
    for (const background of darkBackgrounds) {
      assert.ok(
        contrastRatio(accent.dark, background) >= 4.5,
        `${accent.id} dark contrast below 4.5:1 on ${background}`,
      );
    }
  }
});

test("theme changes and storage updates refresh menu colors without replacing the global palette", () => {
  assert.match(theme, /new Event\("np-theme-change"\)/);
  assert.match(root, /applyMenuAccent\(getStoredMenuAccent\(\), getStoredTheme\(\), false\)/);
  assert.match(root, /MENU_ACCENT_STORAGE_KEY/);
  assert.match(root, /np-theme-change/);
  assert.match(root, /alo-menu-accent-change/);
  assert.match(styles, /--menu-accent: var\(--primary\)/);
  assert.match(sidebar, /var\(--menu-accent, var\(--primary\)\)/);
});

test("settings and navigation expose keyboard focus and mobile-sized targets", () => {
  assert.match(picker, /min-h-11/);
  assert.match(picker, /aria-pressed=\{active === accent\.id\}/);
  assert.match(picker, /focus-visible:ring-2 focus-visible:ring-\[var\(--menu-accent\)\]/);
  assert.match(styles, /homebar-link\[aria-current="page"\][\s\S]*?var\(--menu-accent\)/);
});

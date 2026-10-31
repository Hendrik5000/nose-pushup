import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("public profile toggle exposes its real switch state to assistive technology", () => {
  const source = read("components/PublicProfileSettings.tsx");
  assert.match(source, /role="switch"/);
  assert.match(source, /aria-checked=\{enabled\}/);
  assert.match(source, /aria-label="Öffentliches Profil umschalten"/);
});

test("narrow optional homebars preserve the full labels instead of clipping them", () => {
  const navigation = read("components/TopNav.tsx");
  const styles = read("sport.css");
  assert.match(navigation, /label: "Nexus Chat"/);
  assert.match(styles, /complete labels at 320px/);
  assert.match(
    styles,
    /@media \(max-width: 420px\)[\s\S]*?\.app-homebar \.homebar-link span\s*\{\s*overflow: visible;\s*text-overflow: clip;/,
  );
});

test("dashboard editing actions meet 44px touch targets and center their controls", () => {
  const source = read("components/dashboard/DashboardGrid.tsx");
  const actions = [...source.matchAll(/<button\b[\s\S]*?<\/button>/g)]
    .map(([button]) => button ?? "")
    .filter(
      (button) =>
        /aria-label="(?:Nach oben|Nach unten|Entfernen)"/.test(button) ||
        button.includes("aria-label={`Größe ändern"),
    );

  assert.equal(actions.length, 4);
  for (const action of actions) {
    assert.match(action, /min-h-11 min-w-11/);
    assert.match(action, /items-center justify-center/);
  }
});

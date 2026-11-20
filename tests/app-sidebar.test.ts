import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

test("HomeAppMenuLayout renders an app action sidebar when provided (Alo 1.157)", () => {
  const root = process.cwd();
  const layout = readFileSync(resolve(root, "src/components/HomeAppMenuLayout.tsx"), "utf8");
  assert.match(layout, /sidebar\?: ReactNode/);
  assert.match(layout, /aria-label="App-Aktionen"/);
  assert.match(layout, /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/);
  assert.match(layout, /data-alo-menu-surface="true"/);
  assert.doesNotMatch(layout, /className="alo-launcher"|className="alo-tabs"/);
});

test("Alo Sports offers app-specific sidebar actions", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(route, /sidebar=\{/);
  assert.match(route, /FOOTBALL_LEAGUES\.map/);
  assert.match(route, /onClick=\{\(\) => setLeagueId\(entry\.id\)\}/);
  assert.match(route, /to="\/football"/);
  assert.match(route, /Alo Fu\u00dfball \u00f6ffnen/);
});

test("Alo Fußball offers app-specific sidebar actions", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/football.tsx"), "utf8");
  assert.match(route, /sidebar=\{/);
  assert.match(route, /to="\/sports"/);
  assert.match(route, /Sports-\u00dcbersicht/);
  assert.match(route, /to="\/marketplace"/);
});

test("Areas and Tools pages offer app-specific sidebar actions", () => {
  const root = process.cwd();
  const areas = readFileSync(resolve(root, "src/routes/_authenticated/areas.tsx"), "utf8");
  const tools = readFileSync(resolve(root, "src/routes/_authenticated/tools.tsx"), "utf8");
  assert.match(areas, /sidebar=\{/);
  assert.match(areas, /to="\/tools"/);
  assert.match(areas, /to="\/marketplace"/);
  assert.match(tools, /sidebar=\{/);
  assert.match(tools, /to="\/areas"/);
  assert.match(tools, /to="\/marketplace"/);
});

test("the games catalog offers app-specific sidebar actions outside fullscreen games", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/games.tsx"), "utf8");
  assert.match(route, /aria-label="Alo-Spiele"/);
  assert.match(route, /search=\{\{ game: entry\.game \}\}/);
  assert.match(route, /to="\/"/);
  assert.match(route, /Zur Alo-Startseite/);
  assert.match(route, /setMenuOpen\(\(open\) => !open\)/);
});

test("the settings pages do not repeat the full category list next to the content", () => {
  const root = process.cwd();
  const page = readFileSync(
    resolve(root, "src/routes/_authenticated/profile-page-impl.tsx"),
    "utf8",
  );
  assert.doesNotMatch(page, /SettingsActionsSidebar/);
  assert.doesNotMatch(page, /aria-label="App-Aktionen"/);
  assert.equal((page.match(/PROFILE_SETTINGS_GROUPS\.map/g) ?? []).length, 1);
  assert.match(page, /data-settings-category-list="true"/);
  assert.doesNotMatch(page, /Alo \u00b7 Einstellungen/);
});

test("Alo Health offers app-specific sidebar actions in both design views", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/_authenticated/health.tsx"), "utf8");
  assert.equal((route.match(/aria-label="App-Aktionen"/g) ?? []).length, 2);
  assert.match(route, /function HealthActionsSidebar/);
  assert.match(route, /href="#health-today"/);
  assert.match(route, /to="\/sports"/);
  assert.match(route, /to="\/football"/);
  assert.match(route, /to="\/training"/);
  assert.match(route, /to="\/calisthenics"/);
  assert.match(route, /to="\/exercises"/);
  assert.match(route, /to="\/coach"/);
  assert.match(route, /Sport verbinden/);
});

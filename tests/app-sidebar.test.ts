import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

test("HomeAppMenuLayout renders an app action sidebar when provided (Alo 1.157)", () => {
  const root = process.cwd();
  const layout = readFileSync(resolve(root, "src/components/HomeAppMenuLayout.tsx"), "utf8");
  assert.match(layout, /sidebar\?: ReactNode/);
  assert.match(layout, /ariaLabel = "App-Aktionen"/);
  assert.match(layout, /aria-label=\{ariaLabel\}/);
  assert.match(layout, /export function HomeAppMenuSidebar/);
  assert.match(layout, /<HomeAppMenuSidebar/);
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
  assert.match(route, /import \{ HomeAppMenuSidebar \} from "@\/components\/HomeAppMenuLayout"/);
  assert.match(route, /<HomeAppMenuSidebar/);
  assert.match(route, /ariaLabel="Alo-Spiele"/);
  assert.match(route, /className="absolute bottom-0 left-0 top-0 z-\[80\]/);
  assert.match(route, /<\/HomeAppMenuSidebar>/);
  assert.match(route, /search=\{\{ game: entry\.game \}\}/);
  assert.match(route, /to="\/"/);
  assert.match(route, /Zur Alo-Startseite/);
  assert.match(route, /setMenuOpen\(\(open\) => !open\)/);
});

test("settings keep the existing hub and add a compact sidebar to category pages", () => {
  const root = process.cwd();
  const page = readFileSync(
    resolve(root, "src/routes/_authenticated/profile-page-impl.tsx"),
    "utf8",
  );
  const sidebar = readFileSync(
    resolve(root, "src/components/settings/SettingsActionsSidebar.tsx"),
    "utf8",
  );
  assert.equal(
    (page.match(/<SettingsActionsSidebar activeCategoryId=\{sectionId\} \/>/g) ?? []).length,
    2,
  );
  assert.match(sidebar, /PROFILE_SETTINGS_CATEGORIES\.map/);
  assert.match(sidebar, /to="\/settings\/\$category"/);
  assert.match(sidebar, /params=\{\{ category: category\.id \}\}/);
  assert.match(sidebar, /aria-current=\{activeCategoryId === category\.id \? "page" : undefined\}/);
  assert.match(sidebar, /grid-cols-2 gap-1 lg:grid-cols-1/);
  assert.equal((page.match(/PROFILE_SETTINGS_GROUPS\.map/g) ?? []).length, 1);
  assert.match(page, /data-settings-category-list="true"/);
  assert.doesNotMatch(page, /Alo \u00b7 Einstellungen/);
});

test("Alo Trainingsprogramme offer app-specific sidebar actions in both design views", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/_authenticated/programs.tsx"), "utf8");
  const sidebar = readFileSync(
    resolve(root, "src/components/training/TrainingActionsSidebar.tsx"),
    "utf8",
  );
  assert.equal((route.match(/<HomeAppMenuSidebar/g) ?? []).length, 2);
  assert.equal((route.match(/<TrainingActionsSidebar activePage="programs" \/>/g) ?? []).length, 2);
  assert.equal((route.match(/ariaLabel="Training"/g) ?? []).length, 2);
  assert.match(sidebar, /aria-label="Trainingsnavigation"/);
  assert.match(sidebar, /to: "\/training"/);
  assert.match(sidebar, /to: "\/programs"/);
  assert.match(sidebar, /to: "\/exercises"/);
  assert.match(sidebar, /to: "\/coach"/);
  assert.match(sidebar, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(sidebar, /grid-cols-2 gap-1 lg:grid-cols-1/);
  assert.match(sidebar, /min-h-11/);
});

test("Alo Übungen share active training navigation across Classic and Sport layouts", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/_authenticated/exercises.tsx"), "utf8");
  assert.equal((route.match(/<HomeAppMenuSidebar/g) ?? []).length, 2);
  assert.equal(
    (route.match(/<TrainingActionsSidebar activePage="exercises" \/>/g) ?? []).length,
    2,
  );
  assert.equal((route.match(/ariaLabel="Training"/g) ?? []).length, 2);
  assert.match(route, /max-w-6xl[^"]*lg:grid-cols-\[210px_minmax\(0,1fr\)\]/);
  assert.match(route, /className="lg:col-start-2"/);
  assert.match(route, /mt-6 lg:col-start-2/);
  assert.match(route, /mt-5 flex-1 space-y-3 lg:col-start-2/);
  assert.match(route, /Übungen durchsuchen/);
  assert.match(route, /to="\/calisthenics"/);
});

test("Marketplace shares responsive collection navigation without displaying duplicate controls", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/marketplace.tsx"), "utf8");
  const catalog = readFileSync(
    resolve(root, "src/components/marketplace/MarketplaceAppCatalog.tsx"),
    "utf8",
  );
  assert.equal((route.match(/<MarketplaceCollectionSidebar/g) ?? []).length, 2);
  assert.equal((route.match(/sidebarClassName="hidden lg:block"/g) ?? []).length, 2);
  assert.equal((route.match(/activeCollection=\{activeCollection\}/g) ?? []).length, 4);
  assert.equal((route.match(/onSelect=\{setActiveCollection\}/g) ?? []).length, 2);
  assert.equal((route.match(/onCollectionChange=\{setActiveCollection\}/g) ?? []).length, 2);
  assert.match(catalog, /export function MarketplaceCollectionSidebar/);
  assert.match(catalog, /className="alo-marketplace-categories[^"]*lg:hidden"/);
  assert.equal((catalog.match(/MARKETPLACE_COLLECTIONS\.map/g) ?? []).length, 2);
  assert.match(catalog, /aria-pressed=\{selected\}/);
  assert.match(catalog, /onClick=\{\(\) => onSelect\(collection\.id\)\}/);
  assert.match(catalog, /onCollectionChange\(collection\.id\)/);
});

test("Alo Health uses the shared app sidebar in both design views", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/_authenticated/health.tsx"), "utf8");
  assert.equal((route.match(/<HomeAppMenuSidebar/g) ?? []).length, 2);
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

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const route = readFileSync(resolve(root, "src/routes/games.tsx"), "utf8");
const publicServerFunction = readFileSync(
  resolve(root, "src/lib/public-game.functions.ts"),
  "utf8",
);
const privateServerFunction = readFileSync(
  resolve(root, "src/lib/private-game.functions.ts"),
  "utf8",
);
const gridDefense = readFileSync(resolve(root, "private-game-preview/grid-defense.html"), "utf8");
const kupferkern = readFileSync(resolve(root, "private-game-preview/kupferkern.html"), "utf8");

test("direct `/games` navigation is a public top-level route, not an authenticated child", () => {
  assert.match(route, /createFileRoute\("\/games"\)/);
  assert.equal(existsSync(resolve(root, "src/routes/_authenticated/games.tsx")), false);
  assert.doesNotMatch(
    route,
    /beforeLoad|redirect\(|getAdminAreaAccess|requireSupabaseAuth|usePrivateGameAccess|Route\.useRouteContext/,
  );
  assert.match(route, /Ohne Anmeldung spielbar/);
  assert.match(route, /direkt im Browser und ohne Alo-Konto erreichbar/);
});

test("the public content endpoint uses a strict two-game allowlist and no auth or database", () => {
  assert.match(publicServerFunction, /createServerFn\(\{ method: "POST" \}\)/);
  assert.match(
    publicServerFunction,
    /z\.object\(\{ game: z\.enum\(PUBLIC_GAME_IDS\) \}\)\.strict\(\)/,
  );
  assert.match(
    publicServerFunction,
    /resolvePublicGameDocument\(data\.game, publicGameDocuments\)/,
  );
  assert.match(publicServerFunction, /setResponseHeader\("Cache-Control", "no-store"\)/);
  assert.match(publicServerFunction, /grid-defense\.html\?raw/);
  assert.match(publicServerFunction, /kupferkern\.html\?raw/);
  assert.doesNotMatch(
    publicServerFunction,
    /middleware|requireSupabaseAuth|has_global_role|supabase/i,
  );
});

test("game documents only run in a sandboxed srcDoc without same-origin or public URLs", () => {
  assert.match(route, /getPublicGameDocument\(\{ data: \{ game: requestGame \} \}\)/);
  assert.match(route, /<GameFrame game=\{selectedGame\} document=\{currentDocument\} \/>/);
  assert.match(route, /srcDoc=\{document\}/);
  assert.match(route, /sandbox="allow-scripts"/);
  assert.doesNotMatch(route, /allow-same-origin|VITE_PRIVATE_GAME_PREVIEW_URL|127\.0\.0\.1/);
  assert.doesNotMatch(route, /src=\{(?:frameUrl|gameUrl)\}/);
  assert.match(gridDefense, /Content-Security-Policy/);
  assert.match(kupferkern, /Content-Security-Policy/);
});

test("the legacy private server function remains protected and fail-closed", () => {
  assert.match(privateServerFunction, /createServerFn\(\{ method: "POST" \}\)/);
  assert.match(privateServerFunction, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(privateServerFunction, /withAdminGameAccess\(/);
  assert.match(privateServerFunction, /has_global_role/);
  assert.match(privateServerFunction, /p_role_name: "admin"/);
  assert.match(privateServerFunction, /Cache-Control", "private, no-store/);
});

test("game documents are not standalone static files under the public directory", () => {
  for (const filename of ["grid-defense.html", "kupferkern.html"]) {
    assert.equal(existsSync(resolve(root, "public", filename)), false);
  }
  assert.match(gridDefense, /grid-defense-server-only-v1/);
  assert.match(kupferkern, /kupferkern-server-only-v1/);
});

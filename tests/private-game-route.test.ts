import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const route = readFileSync(resolve(root, "src/routes/_authenticated/games.tsx"), "utf8");
const routeTree = readFileSync(resolve(root, "src/routeTree.gen.ts"), "utf8");
const privateServerFunction = readFileSync(
  resolve(root, "src/lib/private-game.functions.ts"),
  "utf8",
);
const privatePolicy = readFileSync(resolve(root, "src/lib/private-game-policy.ts"), "utf8");
const gameDocuments = Object.fromEntries(
  ["grid-defense", "kupferkern", "neon-starfighter", "chess"].map((id) => [
    id,
    readFileSync(resolve(root, `private-game-preview/${id}.html`), "utf8"),
  ]),
);

test("`/games` is an authenticated child route available to all signed-in accounts", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/games"\)/);
  assert.doesNotMatch(route, /getAdminAreaAccess|beforeLoad: async|redirect/);
  assert.match(route, /usePrivateGameAccess\(user\.id\)/);
  assert.match(route, /isCurrentPrivateGameDocument\(/);
  assert.ok(
    routeTree.includes(
      "Route as AuthenticatedGamesRouteImport } from './routes/_authenticated/games'",
    ),
  );
  const gamesRouteDefinition =
    routeTree.match(
      /const AuthenticatedGamesRoute = AuthenticatedGamesRouteImport\.update\(\{([\s\S]*?)\} as any\)/,
    )?.[1] ?? "";
  assert.match(gamesRouteDefinition, /id: '\/_authenticated\/games'/);
  assert.match(gamesRouteDefinition, /path: '\/games'/);
  assert.match(gamesRouteDefinition, /getParentRoute: \(\) => AuthenticatedRouteRoute/);
  assert.equal(existsSync(resolve(root, "src/routes/games.tsx")), false);
  assert.equal(existsSync(resolve(root, "src/lib/public-game.functions.ts")), false);
  assert.equal(existsSync(resolve(root, "src/lib/public-game-policy.ts")), false);
});

test("the private content endpoint validates four IDs and fails closed through existing auth", () => {
  assert.match(privateServerFunction, /createServerFn\(\{ method: "POST" \}\)/);
  assert.match(privateServerFunction, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(
    privateServerFunction,
    /z\.object\(\{ game: z\.enum\(PRIVATE_GAME_IDS\) \}\)\.strict\(\)/,
  );
  assert.match(privateServerFunction, /withAuthenticatedGameAccess\(/);
  assert.doesNotMatch(privateServerFunction, /has_global_role|p_role_name: "admin"/);
  assert.match(privateServerFunction, /Cache-Control", "private, no-store/);
  assert.match(privateServerFunction, /X-Content-Type-Options", "nosniff/);
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    assert.match(privateServerFunction, new RegExp(`${id.replaceAll("-", "\\-")}\\.html\\?raw`));
    assert.ok(gameDocuments[id as keyof typeof gameDocuments].length > 0);
  }
  assert.match(privatePolicy, /PRIVATE_GAME_IDS = \[/);
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    assert.ok(privatePolicy.includes(`"${id}"`));
  }
  assert.match(privatePolicy, /isAnonymousClaim === true/);
  assert.doesNotMatch(privatePolicy, /AdminRoleResult|checkAdminRole/);
});

test("private game documents render only in a sandboxed iframe and are not public static files", () => {
  assert.match(route, /getPrivateGameDocument\(\{ data: \{ game: requestGame \} \}\)/);
  assert.match(route, /<iframe/);
  assert.match(route, /srcDoc=\{currentDocument\}/);
  assert.match(route, /sandbox="allow-scripts"/);
  assert.doesNotMatch(route, /allow-same-origin|VITE_PRIVATE_GAME_PREVIEW_URL|127\.0\.0\.1/);
  assert.doesNotMatch(route, /src=\{(?:frameUrl|gameUrl)\}/);
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    assert.equal(existsSync(resolve(root, "public", `${id}.html`)), false);
    assert.match(gameDocuments[id as keyof typeof gameDocuments], /Content-Security-Policy/);
  }
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const home = readFileSync(resolve(root, "src/routes/_authenticated/index.tsx"), "utf8");
const publicRoute = readFileSync(resolve(root, "src/routes/games.tsx"), "utf8");
const publicGameServer = readFileSync(resolve(root, "src/lib/public-game.functions.ts"), "utf8");
const adminFunctions = readFileSync(resolve(root, "src/lib/admin.functions.ts"), "utf8");
const privateGameServer = readFileSync(resolve(root, "src/lib/private-game.functions.ts"), "utf8");

test("Home shows both game icons independently of the still-protected Admin tile", () => {
  assert.match(home, /getAdminAreaAccess\(\)/);
  const adminTile =
    home.match(/\{canSeeAdmin\s*&&\s*<HubAppIcon to="\/admin"[\s\S]*?\/>\}/)?.[0] ?? "";
  assert.match(adminTile, /title="Admin"/);
  assert.doesNotMatch(adminTile, /HubGameAppIcon/);

  const gameIconStart = home.indexOf('<HubGameAppIcon game="grid-defense"');
  const gameIconEnd = home.indexOf("</nav>", gameIconStart);
  const publicGameIcons = home.slice(gameIconStart, gameIconEnd);
  assert.notEqual(gameIconStart, -1);
  assert.match(
    publicGameIcons,
    /<HubGameAppIcon game="grid-defense" title="Grid Defense" artwork="gridDefense" \/>/,
  );
  assert.match(
    publicGameIcons,
    /<HubGameAppIcon game="kupferkern" title="Kupferkern" artwork="kupferkern" \/>/,
  );
  assert.doesNotMatch(publicGameIcons, /canSeeAdmin/);
  assert.match(home, /function HubGameAppIcon[\s\S]*?to="\/games"[\s\S]*?search=\{\{ game \}\}/);
  assert.match(home, /setCanSeeAdmin\(false\)/);
  assert.match(home, /\}, \[user\.id\]\)/);
  assert.match(
    adminFunctions,
    /createServerFn\(\{ method: "GET" \}\)[\s\S]*?middleware\(\[requireSupabaseAuth\]\)/,
  );
  assert.match(adminFunctions, /has_global_role/);
});

test("the public games route and endpoint are top-level and strictly allowlisted", () => {
  assert.ok(existsSync(resolve(root, "src/routes/games.tsx")));
  assert.equal(existsSync(resolve(root, "src/routes/_authenticated/games.tsx")), false);
  assert.match(publicRoute, /createFileRoute\("\/games"\)/);
  assert.doesNotMatch(
    publicRoute,
    /beforeLoad|redirect\(|getAdminAreaAccess|requireSupabaseAuth|getPrivateGameDocument|usePrivateGameAccess|Route\.useRouteContext/,
  );
  assert.match(publicRoute, /getPublicGameDocument\(\{ data: \{ game: requestGame \} \}\)/);
  assert.match(publicGameServer, /z\.object\(\{ game: z\.enum\(PUBLIC_GAME_IDS\) \}\)\.strict\(\)/);
  assert.match(publicGameServer, /resolvePublicGameDocument\(data\.game, publicGameDocuments\)/);
  assert.match(publicGameServer, /setResponseHeader\("Cache-Control", "no-store"\)/);
  assert.doesNotMatch(publicGameServer, /middleware|requireSupabaseAuth|has_global_role|supabase/i);
});

test("public games retain the two embedded documents and their iframe isolation", () => {
  assert.match(publicGameServer, /grid-defense\.html\?raw/);
  assert.match(publicGameServer, /kupferkern\.html\?raw/);
  assert.match(publicRoute, /Grid Defense/);
  assert.match(publicRoute, /Kupferkern/);
  assert.match(publicRoute, /sandbox="allow-scripts"/);
  assert.doesNotMatch(publicRoute, /allow-same-origin|src=\{(?:frameUrl|gameUrl)\}/);

  // The legacy private endpoint remains fail-closed for any separate caller.
  assert.match(privateGameServer, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(privateGameServer, /has_global_role/);
  assert.match(privateGameServer, /p_role_name: "admin"/);
  assert.match(privateGameServer, /Cache-Control", "private, no-store/);
});

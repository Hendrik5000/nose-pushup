import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALO_APP_REGISTRY } from "../src/lib/app-registry.ts";

test("app registry entries are unique and well-formed", () => {
  const ids = ALO_APP_REGISTRY.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "Registry-IDs müssen eindeutig sein.");
  const routes = ALO_APP_REGISTRY.map((entry) => entry.route);
  assert.equal(new Set(routes).size, routes.length, "Registry-Routen müssen eindeutig sein.");
  for (const entry of ALO_APP_REGISTRY) {
    assert.ok(entry.id.length > 0, `Eintrag ${entry.id} braucht eine ID.`);
    assert.ok(entry.title.length > 0, `Eintrag ${entry.id} braucht einen Titel.`);
    assert.ok(entry.route.startsWith("/"), `Route von ${entry.id} muss mit "/" beginnen.`);
    assert.ok(entry.aliases.length > 0, `Eintrag ${entry.id} braucht mindestens einen Alias.`);
    for (const alias of entry.aliases) {
      assert.ok(alias.length > 0, `Alias von ${entry.id} darf nicht leer sein.`);
      assert.equal(alias, alias.toLowerCase(), `Alias von ${entry.id} muss kleingeschrieben sein.`);
    }
  }
});

test("Mira pointer routes are derived from the app registry", () => {
  const source = readFileSync(new URL("../src/lib/mira-computer-use.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ ALO_APP_REGISTRY \} from "@\/lib\/app-registry"/);
  assert.match(source, /ALO_APP_REGISTRY\.map/);
  assert.doesNotMatch(source, /keys: \["einstellungen"/, "Keine hartkodierten Routen mehr.");
});

test("home other areas are covered by the app registry", () => {
  const source = readFileSync(new URL("../src/lib/home-app-menus.ts", import.meta.url), "utf8");
  const areaBlock = source.slice(
    source.indexOf("HOME_OTHER_AREAS"),
    source.indexOf("as const satisfies"),
  );
  const areaRoutes = [...areaBlock.matchAll(/to: "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(areaRoutes.length > 0, "HOME_OTHER_AREAS konnte nicht geparst werden.");
  const registryRoutes = new Set(ALO_APP_REGISTRY.map((entry) => entry.route));
  for (const route of areaRoutes) {
    assert.ok(registryRoutes.has(route), `Bereich ${route} fehlt in der App-Registry.`);
  }
});

test("marketplace host routes are covered or intentionally excluded", () => {
  const source = readFileSync(new URL("../src/lib/marketplace.ts", import.meta.url), "utf8");
  const block = source.slice(
    source.indexOf("const MARKETPLACE_APP_ROUTES"),
    source.indexOf("] as const"),
  );
  const routes = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(routes.length > 0, "MARKETPLACE_APP_ROUTES konnte nicht geparst werden.");
  const registryRoutes = new Set(ALO_APP_REGISTRY.map((entry) => entry.route));
  const intentionallyExcluded = new Set(["/areas", "/coach", "/postfach"]);
  for (const route of routes) {
    if (intentionallyExcluded.has(route)) continue;
    assert.ok(registryRoutes.has(route), `Marketplace-Route ${route} fehlt in der App-Registry.`);
  }
});

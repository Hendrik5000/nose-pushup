import assert from "node:assert/strict";
import { test } from "node:test";
import { MARKETPLACE_CATALOG } from "../src/lib/marketplace";
import {
  getMarketplaceCollectionPlugins,
  MARKETPLACE_COLLECTIONS,
} from "../src/lib/marketplace-collections";

test("Marketplace exposes the four requested Play-Store-style collections", () => {
  assert.deepEqual(
    MARKETPLACE_COLLECTIONS.map(({ label }) => label),
    ["Offiziell", "Empfohlen", "Neu", "Von Freunden"],
  );
});

test("official collection contains the registered first-party Alo catalogue", () => {
  const official = getMarketplaceCollectionPlugins(MARKETPLACE_CATALOG, "official");
  assert.equal(
    official.length,
    MARKETPLACE_CATALOG.filter(({ publisher }) => publisher === "Alo").length,
  );
  assert.deepEqual(
    official.map(({ id }) => id),
    MARKETPLACE_CATALOG.map(({ id }) => id),
  );
});

test("recommended and new collections contain only known catalogue entries", () => {
  const knownIds = new Set(MARKETPLACE_CATALOG.map(({ id }) => id));
  const recommended = getMarketplaceCollectionPlugins(MARKETPLACE_CATALOG, "recommended");
  const fresh = getMarketplaceCollectionPlugins(MARKETPLACE_CATALOG, "new");
  assert.deepEqual(
    recommended.map(({ id }) => id),
    ["alo-mira", "alo-nexus-chat", "alo-health-app", "alo-training", "alo-smart-coach"],
  );
  assert.deepEqual(
    fresh.map(({ id }) => id),
    ["alo-grid-defense", "alo-kupferkern", "alo-sports", "alo-neon-starfighter"],
  );
  for (const plugin of [...recommended, ...fresh]) assert.ok(knownIds.has(plugin.id));
});

test("friends collection stays empty until friend-shared entries actually exist", () => {
  assert.deepEqual(getMarketplaceCollectionPlugins(MARKETPLACE_CATALOG, "friends"), []);
});

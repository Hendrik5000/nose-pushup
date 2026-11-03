import assert from "node:assert/strict";
import { test } from "node:test";
import { PRIVATE_GAME_IDS } from "../src/lib/private-game-policy";
import {
  isPublicGameId,
  PUBLIC_GAME_IDS,
  resolvePublicGameDocument,
  type PublicGameId,
} from "../src/lib/public-game-policy";

const documents: Readonly<Record<PublicGameId, string>> = {
  "grid-defense": "grid-defense-payload",
  kupferkern: "kupferkern-payload",
};

test("visitors without any identity can resolve both explicitly public game documents", () => {
  assert.deepEqual(PUBLIC_GAME_IDS, PRIVATE_GAME_IDS);
  assert.deepEqual(PUBLIC_GAME_IDS, ["grid-defense", "kupferkern"]);
  for (const game of PUBLIC_GAME_IDS) {
    assert.equal(isPublicGameId(game), true);
    assert.equal(resolvePublicGameDocument(game, documents), documents[game]);
  }
});

test("unknown, path-like and empty values cannot select another document", () => {
  for (const value of ["admin", "../public/secret", "../../private-game-preview/secret.html", ""]) {
    assert.equal(isPublicGameId(value), false);
    assert.throws(() => resolvePublicGameDocument(value, documents), /Unknown game/);
  }
});

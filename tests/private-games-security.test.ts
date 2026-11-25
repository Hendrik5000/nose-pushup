import assert from "node:assert/strict";
import { test } from "node:test";
import { withAuthenticatedGameAccess } from "../src/lib/private-game-policy";

test("an authenticated account receives the requested private game document", async () => {
  let documentLoads = 0;
  const document = await withAuthenticatedGameAccess(false, () => {
    documentLoads += 1;
    return "private-game-html";
  });

  assert.equal(document, "private-game-html");
  assert.equal(documentLoads, 1);
});

test("an authenticated account can load any registered game without an admin-role check", async () => {
  const loadedGames: string[] = [];
  for (const game of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    const document = await withAuthenticatedGameAccess(false, () => {
      loadedGames.push(game);
      return `${game}-html`;
    });
    assert.equal(document, `${game}-html`);
  }

  assert.deepEqual(loadedGames, ["grid-defense", "kupferkern", "neon-starfighter", "chess"]);
});

test("anonymous sessions are rejected before private game documents are loaded", async () => {
  for (const claim of [true, "true"]) {
    let documentLoads = 0;
    await assert.rejects(
      withAuthenticatedGameAccess(claim, () => {
        documentLoads += 1;
        return "must-not-leak";
      }),
      /Not authorized/,
    );
    assert.equal(documentLoads, 0);
  }
});

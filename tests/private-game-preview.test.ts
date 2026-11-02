import assert from "node:assert/strict";
import { test } from "node:test";
import { isPrivateGamePreviewOpen } from "../src/lib/private-game-preview";

test("the private game preview is fail-closed unless both development and explicit local opt-in apply", () => {
  assert.equal(isPrivateGamePreviewOpen(false, "?preview=local"), false);
  assert.equal(isPrivateGamePreviewOpen(true, ""), false);
  assert.equal(isPrivateGamePreviewOpen(true, "?preview=1"), false);
  assert.equal(isPrivateGamePreviewOpen(true, "?preview=local"), true);
});

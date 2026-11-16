import assert from "node:assert/strict";
import { test } from "node:test";
import { toggleGameFullscreen } from "../src/lib/game-fullscreen";

test("enters fullscreen when the game frame is not fullscreen", async () => {
  let requested = false;
  const element = { requestFullscreen: async () => { requested = true; } };
  const fullscreenDocument = {
    fullscreenElement: null,
    exitFullscreen: async () => {},
  };

  assert.equal(await toggleGameFullscreen(element, fullscreenDocument), true);
  assert.equal(requested, true);
});

test("exits fullscreen when the game frame is already fullscreen", async () => {
  let exited = false;
  const element = { requestFullscreen: async () => {} };
  const fullscreenDocument = {
    fullscreenElement: element,
    exitFullscreen: async () => { exited = true; },
  };

  assert.equal(await toggleGameFullscreen(element, fullscreenDocument), true);
  assert.equal(exited, true);
});

test("returns false when fullscreen is unsupported or rejected", async () => {
  const unsupported = { fullscreenElement: null, exitFullscreen: async () => {} };
  const rejecting = {
    requestFullscreen: async () => { throw new Error("denied"); },
  };

  assert.equal(await toggleGameFullscreen({} , unsupported), false);
  assert.equal(await toggleGameFullscreen(rejecting, unsupported), false);
  assert.equal(await toggleGameFullscreen(null, unsupported), false);
});

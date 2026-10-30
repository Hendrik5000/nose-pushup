import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_IMAGE_MAX_BYTES,
  checkChatImageInput,
  checkChatImageOutput,
  chatImagePath,
  fitWithin,
  isChatImagePath,
  needsReencode,
  safeImageName,
} from "../src/lib/nexus-images";

const U = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";

test("only jpeg, png, webp and gif are accepted", () => {
  assert.ok(checkChatImageInput({ type: "image/webp", size: 10 }).ok);
  assert.ok(!checkChatImageInput({ type: "image/svg+xml", size: 10 }).ok);
  assert.ok(!checkChatImageInput({ type: "application/pdf", size: 10 }).ok);
  assert.ok(!checkChatImageInput({ type: "image/png", size: 0 }).ok);
});

test("output is limited to 5 MB", () => {
  assert.ok(checkChatImageOutput({ type: "image/jpeg", size: CHAT_IMAGE_MAX_BYTES }).ok);
  assert.ok(!checkChatImageOutput({ type: "image/jpeg", size: CHAT_IMAGE_MAX_BYTES + 1 }).ok);
});

test("fitWithin scales down to 1600 px and never upscales", () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 1600, height: 1200, scaled: true });
  assert.deepEqual(fitWithin(3000, 4000), { width: 1200, height: 1600, scaled: true });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600, scaled: false });
  assert.equal(fitWithin(0, 10).width, 0);
});

test("gifs are never re-encoded, large images are", () => {
  assert.equal(needsReencode("image/gif", 4_000_000, 4000, 4000), false);
  assert.equal(needsReencode("image/jpeg", 100_000, 800, 600), false);
  assert.equal(needsReencode("image/jpeg", 100_000, 3000, 2000), true);
  assert.equal(needsReencode("image/png", 2_000_000, 800, 600), true);
});

test("storage paths follow the database convention", () => {
  const dm = chatImagePath(U, { kind: "dm", id: C }, F, "image/jpeg");
  assert.equal(dm, `${U}/conv-${C}/${F}.jpg`);
  assert.ok(isChatImagePath(dm));
  const room = chatImagePath(U, { kind: "room", id: C }, F, "image/png");
  assert.equal(room, `${U}/room-${C}/${F}.png`);
  assert.ok(!isChatImagePath(`${U}/../x/${F}.jpg`));
  assert.ok(!isChatImagePath(`${U}/conv-${C}/${F}.svg`));
  assert.ok(!isChatImagePath(null));
});

test("file names are cleaned and limited", () => {
  assert.equal(safeImageName("a/b\\c.png"), "abc.png");
  assert.equal(safeImageName("   "), "Bild");
  assert.equal(safeImageName("x".repeat(500)).length, 200);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildGymInviteMessage } from "../src/lib/gym-partner";

test("Gym invite message normalises the code and explains the manual join flow", () => {
  const message = buildGymInviteMessage("a1b2c3d4e5f6");
  assert.match(message, /A1B2C3D4E5F6/);
  assert.match(message, /Gym → Zu zweit/);
  assert.match(message, /einzelne Freigaben aktivierst/);
  assert.match(message, /zeitlich begrenzt gültig/);
});

test("Gym invite message includes a valid expiry", () => {
  const message = buildGymInviteMessage("A1B2C3D4E5F6", "2026-11-18T22:00:00.000Z");
  assert.match(message, /gültig bis/);
});

test("Gym invite message rejects malformed codes", () => {
  assert.throws(() => buildGymInviteMessage("not-a-code"), /Ungültiger Einladungscode/);
});

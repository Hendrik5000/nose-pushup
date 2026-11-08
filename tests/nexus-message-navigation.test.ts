import assert from "node:assert/strict";
import test from "node:test";
import { nexusMessageElementId, nexusScrollBehavior } from "../src/lib/nexus-message-navigation";

test("message element ids are stable and safe for unusual ids", () => {
  assert.equal(nexusMessageElementId("message-123"), "msg-message-123");
  assert.equal(nexusMessageElementId("id with spaces"), "msg-id%20with%20spaces");
});

test("reply jumps respect either account or device reduced-motion preference", () => {
  assert.equal(nexusScrollBehavior(false, false), "smooth");
  assert.equal(nexusScrollBehavior(true, false), "auto");
  assert.equal(nexusScrollBehavior(false, true), "auto");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/chat/LocalChatShell.tsx", "utf8");
const replyStripStart = source.indexOf("{replyTo && (");
const replyStripEnd = source.indexOf("{/* Quick replies + workout share */}", replyStripStart);

assert.notEqual(replyStripStart, -1, "reply context strip should exist");
assert.notEqual(replyStripEnd, -1, "reply context strip should end before quick replies");
const replyStrip = source.slice(replyStripStart, replyStripEnd);

test("reply cancel control is named, touch-friendly, and clears replyTo", () => {
  const button = replyStrip.match(/<button\b[\s\S]*?<\/button>/)?.[0];
  assert.ok(button, "reply context strip should contain its cancel button");
  assert.match(button, /aria-label="Antwort abbrechen"/);
  assert.match(button, /className="[^"]*\bh-11\b[^"]*\bw-11\b[^"]*\bshrink-0\b/);
  assert.match(button, /items-center\s+justify-center/);
  assert.match(button, /focus-visible:ring-2/);
  assert.match(button, /onClick=\{\(\) => setReplyTo\(null\)\}/);
  assert.match(button, />\s*×\s*</);
  assert.match(replyStrip, /Antwort auf:\s*<strong>\{replyTo\.content\}<\/strong>/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const backend = readFileSync(new URL("../src/lib/chat-backend.ts", import.meta.url), "utf8");
const loadMessages = backend.match(
  /export async function loadMessages\([\s\S]*?(?=\nexport async function postMessage)/,
)?.[0];

test("cloud chat loads the latest 200 messages in chronological order with their reactions", () => {
  assert.ok(loadMessages, "loadMessages implementation should exist");
  assert.match(loadMessages, /\.order\("created_at" as never,\s*\{ ascending: false \}\)/);
  assert.match(loadMessages, /\.limit\(200\)/);
  assert.match(
    loadMessages,
    /const messages = \[\.\.\.\(\(data \?\? \[\]\) as unknown as LocalMessage\[\]\)\]\.reverse\(\);/,
  );
  assert.match(loadMessages, /const ids = messages\.map\(\(m\) => m\.id\);/);
  assert.match(loadMessages, /\.in\("message_id" as never, ids as never\)/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { copyTextToClipboard } from "../src/lib/clipboard";

test("copy helper sends the complete code text and reports success", async () => {
  let copied = "";
  const result = await copyTextToClipboard("const answer = 42;", {
    writeText: async (text) => {
      copied = text;
    },
  });
  assert.equal(result, true);
  assert.equal(copied, "const answer = 42;");
});

test("copy helper reports browser clipboard failure without throwing", async () => {
  const result = await copyTextToClipboard("code", {
    writeText: async () => {
      throw new Error("permission denied");
    },
  });
  assert.equal(result, false);
});

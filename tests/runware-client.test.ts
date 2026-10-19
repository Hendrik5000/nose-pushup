import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  checkRunwareImage,
  readRunwareStream,
  runwareCostLabel,
  safeRunwareMediaUrl,
} from "../src/lib/runware-client";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Runware image intake limits types and size before upload", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"]) {
    assert.doesNotThrow(() => checkRunwareImage({ type, size: 1024 * 1024 }));
  }
  for (const type of ["image/svg+xml", "text/html", "image/gif", ""]) {
    assert.throws(() => checkRunwareImage({ type, size: 10 }));
  }
  assert.throws(() => checkRunwareImage({ type: "image/png", size: 0 }));
  assert.throws(() => checkRunwareImage({ type: "image/png", size: 1024 * 1024 + 1 }));
});

test("actual cost has a distinct USD label and never turns unknown into free", () => {
  assert.match(runwareCostLabel(0.0123), /Ist-Kosten: 0,0123 USD/);
  assert.match(runwareCostLabel(0), /0 USD/);
  for (const cost of [undefined, NaN, Infinity, -1])
    assert.match(runwareCostLabel(cost), /nicht gemeldet/);
});

test("NDJSON handles fragmented Unicode and last lines without newline", async () => {
  const bytes = new TextEncoder().encode('{"type":"delta","text":"Grüße"}\n{"type":"result"}');
  const events: unknown[] = [];
  await readRunwareStream(
    new Response(
      new ReadableStream({
        start(controller) {
          for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
          controller.close();
        },
      }),
    ),
    (event) => events.push(event),
  );
  assert.deepEqual(events, [{ type: "delta", text: "Grüße" }, { type: "result" }]);
});

test("stream parsing rejects malformed streams and cancellation rather than silently succeeding", async () => {
  await assert.rejects(readRunwareStream(new Response("not-json\n"), () => {}));
  await assert.rejects(readRunwareStream(new Response("unavailable", { status: 503 }), () => {}));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readRunwareStream(new Response("{}\n"), () => {}, controller.signal),
    /abgebrochen/,
  );
});

test("Runware is isolated from legacy browser keys and normal chat submission", () => {
  const ui = read("src/components/alo/MiraRunwareTools.tsx");
  const page = read("src/routes/_authenticated/ai.tsx");
  assert.doesNotMatch(ui, /localStorage|sessionStorage|apiKey\s*:/);
  assert.match(ui, /Nicht eingerichtet/);
  assert.match(ui, /Kostenschätzung/);
  assert.match(ui, /Abbrechen · nicht starten/);
  assert.match(ui, /setReview\(false\)/);
  assert.match(ui, /busyRef\.current/);
  assert.match(ui, /onKeepInChat/);
  assert.match(page, /onClick=\{startNewSession\}[\s\S]*?aria-label="Neuer Chat"/);
  const submit = page.slice(page.indexOf("const submit ="), page.indexOf("const regenerate ="));
  assert.doesNotMatch(submit, /runMiraRunware|setRunwareOpen|Kostenpflichtig/);
  assert.match(page, /MiraRunwareResult result=\{m\.media\}/);
});

test("persisted media URLs cannot execute scripts or send users to lookalike hosts", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script></script>",
    "http://im.runware.ai/x",
    "https://runware.ai.evil.test/x",
    "https://evilrunware.ai/x",
    "https://user:secret@im.runware.ai/x",
  ])
    assert.equal(safeRunwareMediaUrl(url), undefined);
  assert.equal(
    safeRunwareMediaUrl("https://im.runware.ai/image/result.png"),
    "https://im.runware.ai/image/result.png",
  );
});

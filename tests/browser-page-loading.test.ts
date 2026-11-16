import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBrowserPageInParallel } from "../src/lib/browser-page-loading";

test("publishes the web view before the slower reader request completes", async () => {
  const events: string[] = [];
  let finishReader!: (value: string) => void;

  const loading = loadBrowserPageInParallel(
    async () => "<html>ready</html>",
    () =>
      new Promise<string>((resolve) => {
        finishReader = resolve;
      }),
    () => events.push("html"),
    () => events.push("reader"),
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["html"]);

  finishReader("reader text");
  assert.deepEqual(await loading, { html: "<html>ready</html>", reader: "reader text" });
  assert.deepEqual(events, ["html", "reader"]);
});

test("publishes reader text immediately when it is the first available result", async () => {
  const events: string[] = [];
  let finishHtml!: (value: string) => void;

  const loading = loadBrowserPageInParallel(
    () =>
      new Promise<string>((resolve) => {
        finishHtml = resolve;
      }),
    async () => "reader text",
    () => events.push("html"),
    () => events.push("reader"),
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["reader"]);

  finishHtml("<html>ready</html>");
  assert.deepEqual(await loading, { html: "<html>ready</html>", reader: "reader text" });
  assert.deepEqual(events, ["reader", "html"]);
});

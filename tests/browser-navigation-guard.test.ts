import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createBrowserNavigationGuard,
  nextBrowserHistory,
} from "../src/lib/browser-navigation-guard.ts";
import { isCurrentBrowserFrameMessage } from "../src/lib/browser-frame-messages.ts";
import { loadBrowserPageInParallel } from "../src/lib/browser-page-loading.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("late HTML, reader and final results cannot overwrite a newer page", async () => {
  const guard = createBrowserNavigationGuard();
  const old = guard.begin("tab");
  const html = deferred<string>();
  const reader = deferred<string>();
  const events: string[] = [];
  const page = loadBrowserPageInParallel(
    () => html.promise,
    () => reader.promise,
    (value) => {
      if (old()) events.push(`html:${value}`);
    },
    (value) => {
      if (old()) events.push(`reader:${value}`);
    },
  ).then(() => {
    if (old()) events.push("old:done");
  });

  const latest = guard.begin("tab");
  if (latest()) events.push("new:loading");
  html.resolve("old page");
  reader.resolve("old reader");
  await page;
  if (latest()) events.push("new:done");
  assert.deepEqual(events, ["new:loading", "new:done"]);
});

test("search and navigation invalidate one another without affecting another tab", () => {
  const guard = createBrowserNavigationGuard();
  const firstSearch = guard.begin("a");
  const otherTab = guard.begin("b");
  const page = guard.begin("a");
  assert.equal(firstSearch(), false);
  assert.equal(page(), true);
  assert.equal(otherTab(), true);
  const secondSearch = guard.begin("a");
  assert.equal(page(), false);
  assert.equal(secondSearch(), true);
  assert.equal(otherTab(), true);
});

test("reset or closure invalidates pending work even when a tab id is reused", () => {
  const guard = createBrowserNavigationGuard();
  const old = guard.begin("a");
  guard.invalidate("a");
  assert.equal(old(), false);
  const fresh = guard.begin("a");
  assert.equal(old(), false);
  assert.equal(fresh(), true);
});

test("iframe messages require the active frame source, opaque origin and current document token", () => {
  const activeFrame = {};
  const currentToken = "current-document";
  assert.equal(
    isCurrentBrowserFrameMessage(activeFrame, "null", currentToken, activeFrame, currentToken),
    true,
  );
  assert.equal(
    isCurrentBrowserFrameMessage({}, "null", currentToken, activeFrame, currentToken),
    false,
  );
  assert.equal(
    isCurrentBrowserFrameMessage(
      activeFrame,
      "https://example.com",
      currentToken,
      activeFrame,
      currentToken,
    ),
    false,
  );
  assert.equal(
    isCurrentBrowserFrameMessage(activeFrame, "null", "old-document", activeFrame, currentToken),
    false,
  );
  assert.equal(
    isCurrentBrowserFrameMessage(activeFrame, "null", currentToken, activeFrame, ""),
    false,
  );
});

test("history uses the latest state, supports back and forward, and drops stale forward entries", () => {
  const a = nextBrowserHistory([], -1, { kind: "url", value: "A" }, true);
  const b = nextBrowserHistory(a.history, a.historyIndex, { kind: "url", value: "B" }, true);
  assert.deepEqual(b, {
    history: [
      { kind: "url", value: "A" },
      { kind: "url", value: "B" },
    ],
    historyIndex: 1,
  });
  const back = nextBrowserHistory(
    b.history,
    b.historyIndex,
    { kind: "url", value: "A" },
    false,
    0,
  );
  assert.deepEqual(back, {
    history: [
      { kind: "url", value: "A" },
      { kind: "url", value: "B" },
    ],
    historyIndex: 0,
  });
  const forward = nextBrowserHistory(
    back.history,
    back.historyIndex,
    { kind: "url", value: "B" },
    false,
    1,
  );
  assert.deepEqual(forward, b);
  const replacement = nextBrowserHistory(
    back.history,
    back.historyIndex,
    { kind: "url", value: "C" },
    true,
  );
  assert.deepEqual(replacement, {
    history: [
      { kind: "url", value: "A" },
      { kind: "url", value: "C" },
    ],
    historyIndex: 1,
  });
  const afterHome = nextBrowserHistory(
    b.history,
    -1,
    { kind: "url", value: "D" },
    true,
  );
  assert.deepEqual(afterHome, { history: [{ kind: "url", value: "D" }], historyIndex: 0 });
});

test("search entries participate in history and retain the right branch after back", () => {
  const page = nextBrowserHistory([], -1, { kind: "url", value: "A" }, true);
  const search = nextBrowserHistory(
    page.history,
    page.historyIndex,
    { kind: "search", value: "push ups" },
    true,
  );
  const nextPage = nextBrowserHistory(
    search.history,
    search.historyIndex,
    { kind: "url", value: "B" },
    true,
  );
  const backToSearch = nextBrowserHistory(
    nextPage.history,
    nextPage.historyIndex,
    { kind: "search", value: "push ups" },
    false,
    1,
  );
  assert.equal(backToSearch.history[backToSearch.historyIndex]?.kind, "search");
  assert.equal(backToSearch.history[backToSearch.historyIndex]?.value, "push ups");
  const reloadedSearch = nextBrowserHistory(
    backToSearch.history,
    backToSearch.historyIndex,
    { kind: "search", value: "push ups" },
    false,
    backToSearch.historyIndex,
  );
  assert.deepEqual(reloadedSearch, backToSearch);
  const branch = nextBrowserHistory(
    backToSearch.history,
    backToSearch.historyIndex,
    { kind: "search", value: "new query" },
    true,
  );
  assert.deepEqual(branch, {
    history: [
      { kind: "url", value: "A" },
      { kind: "search", value: "push ups" },
      { kind: "search", value: "new query" },
    ],
    historyIndex: 2,
  });
});

test("component guards deferred page and search updates and invalidates non-loading destinations", () => {
  const source = readFileSync(
    new URL("../src/components/browser/AloBrowser.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /t\.id === id && \(!isCurrent \|\| isCurrent\(\)\)/);
  assert.equal((source.match(/navigationGuard\.begin\(tabId\)/g) || []).length, 2);
  assert.match(source, /if \(!isCurrent\(\)\) return;/);
  assert.match(
    source,
    /hasUsableHtml \? \{ readerText: reader \} : \{ readerText: reader, mode: "reader" \},\s*isCurrent,/,
  );
  assert.match(
    source,
    /navigationGuard\.invalidate\(tabId\);\s*updateTab\(tabId, \{\s*title: "Google Suche"/,
  );
  assert.match(
    source,
    /navigationGuard\.invalidate\(activeTab\.id\);\s*updateTab\(activeTab\.id, \{\s*mode: "home"/,
  );
  assert.match(source, /navigationGuard\.invalidate\(id\);\s*if \(tabs\.length === 1\)/);
  assert.match(
    source,
    /nextBrowserHistory\(\s*tab\.history,\s*tab\.historyIndex,\s*\{ kind: "url", value: targetUrl \},\s*pushHistory,\s*historyIndex,?\s*\)/,
  );
  assert.match(source, /history: \[\],\s*historyIndex: -1,\s*notice: ""/);
  assert.match(source, /runSearch\(activeTab\.id, target\.value, false, targetIndex\)/);
  assert.match(source, /openUrl\(activeTab\.id, target\.value, false, targetIndex\)/);
  assert.match(
    source,
    /const reloadActiveTab = \(\) => \{\s*if \(activeTab\.mode === "search"\) \{\s*const currentEntry = activeTab\.history\[activeTab\.historyIndex\];\s*const query = currentEntry\?\.kind === "search" \? currentEntry\.value : activeTab\.input;\s*runSearch\(activeTab\.id, query, false, activeTab\.historyIndex\);/,
  );
  assert.match(source, /onClick=\{reloadActiveTab\}/);
  assert.match(
    source,
    /onClick=\{goForward\}[\s\S]{0,180}disabled=\{activeTab\.historyIndex >= activeTab\.history\.length - 1\}/,
  );
  assert.match(source, /ref=\{browserFrameRef\}/);
  assert.match(
    source,
    /isCurrentBrowserFrameMessage\(\s*ev\.source,\s*ev\.origin,\s*ev\.data\?\.frameToken,\s*browserFrameRef\.current\?\.contentWindow,\s*activeTabRef\.current\.frameToken,\s*\)/,
  );
  assert.match(source, /frameToken: aloFrameToken/);
  assert.match(source, /crypto\.randomUUID\(\)/);
});

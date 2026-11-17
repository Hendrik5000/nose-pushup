import assert from "node:assert/strict";
import { test } from "node:test";

import {
  browserProxyUrls,
  browserReaderUrl,
  cacheBrowserPage,
  clearBrowserPageCacheForTests,
  fetchBrowserPage,
  fetchFirstUsable,
  readCachedBrowserPage,
  setBrowserFetchForTests,
} from "../src/lib/browser-fetch.ts";

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

test("browser proxy and reader urls cover the target with encoded url", () => {
  const urls = browserProxyUrls("https://example.com/a?b=1");
  assert.equal(urls.length, 3);
  assert.ok(urls[0].startsWith("https://api.allorigins.win/raw?url=https%3A%2F%2Fexample.com"));
  assert.ok(urls[1].includes("api.codetabs.com"));
  assert.ok(urls[2].includes("corsproxy.io"));
  assert.equal(browserReaderUrl("https://example.com"), "https://r.jina.ai/https://example.com");
});

test("fetchFirstUsable takes the first usable response even if a faster one is too short", async () => {
  setBrowserFetchForTests(async (url) => {
    if (url.includes("slow")) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return jsonResponse("x".repeat(300));
    }
    return jsonResponse("short");
  });
  try {
    const text = await fetchFirstUsable(["https://fast.example", "https://slow.example"], {
      minLength: 200,
    });
    assert.equal(text, "x".repeat(300));
  } finally {
    setBrowserFetchForTests(undefined);
  }
});

test("fetchFirstUsable falls through to the next source when one fails", async () => {
  setBrowserFetchForTests(async (url) => {
    if (url.includes("first")) throw new Error("boom");
    return jsonResponse("y".repeat(250));
  });
  try {
    const text = await fetchFirstUsable(["https://first.example", "https://second.example"], {
      minLength: 200,
    });
    assert.equal(text, "y".repeat(250));
  } finally {
    setBrowserFetchForTests(undefined);
  }
});

test("fetchFirstUsable rejects when every source fails", async () => {
  setBrowserFetchForTests(async () => {
    throw new Error("offline");
  });
  try {
    await assert.rejects(
      () => fetchFirstUsable(["https://a.example", "https://b.example"], { minLength: 10 }),
      /offline|Keine Quelle/,
    );
  } finally {
    setBrowserFetchForTests(undefined);
  }
});

test("fetchFirstUsable aborts a hanging source after the timeout", async () => {
  setBrowserFetchForTests(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Request aborted")));
      }),
  );
  try {
    await assert.rejects(
      () => fetchFirstUsable(["https://hanging.example"], { timeoutMs: 50, minLength: 10 }),
      /aborted|Keine Quelle/,
    );
  } finally {
    setBrowserFetchForTests(undefined);
  }
});

test("browser pages are cached so revisits skip the network", async () => {
  clearBrowserPageCacheForTests();
  cacheBrowserPage("https://cached.example", "<html>cached</html>", "reader text");
  const cached = readCachedBrowserPage("https://cached.example");
  assert.equal(cached?.html, "<html>cached</html>");
  assert.equal(cached?.reader, "reader text");

  let networkCalls = 0;
  setBrowserFetchForTests(async () => {
    networkCalls += 1;
    return jsonResponse("z".repeat(300));
  });
  try {
    const page = await fetchBrowserPage("https://cached.example");
    assert.equal(page.html, "<html>cached</html>");
    assert.equal(networkCalls, 0);
  } finally {
    setBrowserFetchForTests(undefined);
    clearBrowserPageCacheForTests();
  }
});

test("fetchBrowserPage returns html and reader independently when one fails", async () => {
  clearBrowserPageCacheForTests();
  setBrowserFetchForTests(async (url) => {
    if (url.includes("r.jina.ai"))
      return jsonResponse("Reader-Inhalt der Seite mit ausreichend vielen Zeichen für den Test.");
    throw new Error("proxy down");
  });
  try {
    const page = await fetchBrowserPage("https://only-reader.example");
    assert.equal(page.html, "");
    assert.match(page.reader, /Reader-Inhalt der Seite/);
  } finally {
    setBrowserFetchForTests(undefined);
    clearBrowserPageCacheForTests();
  }
});

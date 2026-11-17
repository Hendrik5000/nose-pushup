import assert from "node:assert/strict";
import { test } from "node:test";

import {
  browserStepsToSystemBlock,
  extractWebTarget,
  hasWebIntent,
  miraWebSearch,
  parseJinaSearchResults,
  setMiraBrowserFetchForTests,
  takeBrowserOpenUrl,
} from "../src/lib/mira-browser.ts";

test("web intents are detected for searches, urls and current-events questions", () => {
  assert.ok(hasWebIntent("Suche im Web nach Push-Up Weltrekord"));
  assert.ok(hasWebIntent("recherchiere im internet: bundesliga Spieltag"));
  assert.ok(hasWebIntent("Öffne tagesschau.de"));
  assert.ok(hasWebIntent("https://www.heise.de/news/artikel"));
  assert.ok(hasWebIntent("Was gibt es aktuell für Nachrichten?"));
  assert.ok(hasWebIntent("aktuelle Ergebnisse der Bundesliga"));
  assert.equal(hasWebIntent("Erkläre mir das Kreuzheben-Grundmuster"), false);
  assert.equal(hasWebIntent("Schreibe ein Gedicht über den Herbst"), false);
});

test("web targets are extracted as url or search query", () => {
  assert.deepEqual(extractWebTarget("Öffne https://www.tagesschau.de/inland"), {
    kind: "url",
    value: "https://www.tagesschau.de/inland",
  });
  assert.deepEqual(extractWebTarget("öffne heise.de bitte"), {
    kind: "url",
    value: "https://heise.de",
  });
  const query = extractWebTarget("Suche im Web nach Push-Up Weltrekord");
  assert.equal(query?.kind, "query");
  assert.match((query as { value: string }).value, /Push-Up Weltrekord/);
  assert.equal(extractWebTarget("Hilf mir beim Training"), null);
});

test("jina search results are parsed into titles, urls and snippets", () => {
  const raw = [
    "[1] Title: Erster Treffer",
    "URL Source: https://example.com/eins",
    "Description: Beschreibung eins",
    "",
    "[2] Title: Zweiter Treffer",
    "URL Source: https://example.com/zwei",
    "Snippet-Text ohne Description",
  ].join("\n");
  const parsed = parseJinaSearchResults(raw);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, "Erster Treffer");
  assert.equal(parsed[0].url, "https://example.com/eins");
  assert.equal(parsed[1].snippet.includes("Snippet-Text"), true);
});

test("miraWebSearch uses jina and falls back to wikipedia", async () => {
  setMiraBrowserFetchForTests(async (url) => {
    if (String(url).includes("s.jina.ai")) {
      return new Response("keine nutzbaren ergebnisse", { status: 200 });
    }
    assert.ok(String(url).includes("de.wikipedia.org"));
    return new Response(
      JSON.stringify([
        "query",
        ["Krafttraining"],
        ["Krafttraining verbessert die Kraft"],
        ["https://de.wikipedia.org/wiki/Krafttraining"],
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  try {
    const results = await miraWebSearch("Krafttraining");
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Krafttraining");
    assert.equal(results[0].url, "https://de.wikipedia.org/wiki/Krafttraining");
  } finally {
    setMiraBrowserFetchForTests(undefined);
  }
});

test("browser steps become an untrusted system block with the raw results", () => {
  const block = browserStepsToSystemBlock(
    [
      { kind: "search", query: "Bundesliga", resultCount: 2 },
      { kind: "read", url: "https://example.com", title: "Beispiel", chars: 120 },
    ],
    "Treffer 1\nTreffer 2",
  );
  assert.match(block, /untrusted Kontext/);
  assert.match(block, /Websuche „Bundesliga“ mit 2 Treffern/);
  assert.match(block, /Gelesene Seite: Beispiel/);
  assert.match(block, /Web-Kontext Beginn/);
  assert.match(block, /Treffer 1/);
  const empty = browserStepsToSystemBlock([]);
  assert.equal(empty, "");
});

test("browser open urls travel through sessionStorage to the Alo-Browser", () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem("alo-browser-open-url", "https://example.com/gelesen");
  assert.equal(takeBrowserOpenUrl(), "https://example.com/gelesen");
  assert.equal(takeBrowserOpenUrl(), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertPublicHttpUrl,
  buildFormSearchUrl,
  extractBrowserAgentPage,
  fetchBrowserAgentPage,
  responseBlocksFraming,
  setBrowserAgentFetchForTests,
  stripHtmlToText,
  type BrowserAgentPage,
} from "../src/lib/browser-agent.server.ts";
import {
  findAgentLink,
  findSiteSearchUrl,
  runMiraSiteAction,
  setMiraBrowserAgentForTests,
} from "../src/lib/mira-browser-agent.ts";

test("assertPublicHttpUrl blocks private hosts and non-http protocols", () => {
  for (const blocked of [
    "http://localhost:3000/x",
    "http://127.0.0.1/x",
    "http://10.0.0.5/x",
    "http://192.168.1.10/x",
    "http://169.254.169.254/latest",
    "http://172.16.0.1/x",
    "http://172.31.255.255/x",
    "http://0.0.0.0/x",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "https://myserver.local/x",
    "https://service.internal/x",
    "keine-url",
  ]) {
    assert.throws(() => assertPublicHttpUrl(blocked));
  }
  assert.equal(assertPublicHttpUrl("https://example.com/seite").hostname, "example.com");
  assert.equal(assertPublicHttpUrl("http://example.com").protocol, "http:");
  assert.equal(assertPublicHttpUrl("https://172.15.0.1/x").hostname, "172.15.0.1");
});

test("stripHtmlToText removes tags, scripts and decodes entities", () => {
  const text = stripHtmlToText(
    "<html><head><script>alert(1)</script><style>.a{}</style></head><body><h1>Hallo&nbsp;Welt</h1><p>A &amp; B &lt;C&gt;</p></body></html>",
  );
  assert.equal(text, "Hallo Welt A & B <C>");
});

test("extractBrowserAgentPage extracts title, absolutized links and GET forms", () => {
  const html = `
    <html><head><title>Example Shop</title></head><body>
      <a href="/produkte?tag=1">Produkte</a>
      <a href="https://example.com/produkte?tag=1">Produkte</a>
      <a href="https://andere.de/x">Extern</a>
      <a href="javascript:void(0)">Skript</a>
      <a href="/leer"></a>
      <a href="/mehr">Mehr Infos</a>
      <form action="/suche" method="get"><input type="text" name="q"></form>
      <form action="/login" method="post"><input type="text" name="user"></form>
    </body></html>`;
  const page = extractBrowserAgentPage(html, "https://example.com/start");
  assert.equal(page.title, "Example Shop");
  assert.equal(page.url, "https://example.com/start");
  assert.ok(page.text.includes("Mehr Infos"));
  assert.ok(page.text.includes("Extern"));
  const hrefs = page.links.map((link) => link.href);
  assert.ok(hrefs.includes("https://example.com/produkte?tag=1"));
  assert.equal(hrefs.filter((href) => href === "https://example.com/produkte?tag=1").length, 1);
  assert.ok(hrefs.includes("https://andere.de/x"));
  assert.ok(!hrefs.some((href) => href.startsWith("javascript:")));
  const mehr = page.links.find((link) => link.href === "https://example.com/mehr");
  assert.equal(mehr?.text, "Mehr Infos");
  assert.deepEqual(page.forms, [{ action: "https://example.com/suche", fieldName: "q" }]);
  assert.deepEqual(
    buildFormSearchUrl(page.forms[0], "schuhe"),
    "https://example.com/suche?q=schuhe",
  );
});

test("extractBrowserAgentPage caps links and text length", () => {
  const anchors = Array.from({ length: 60 }, (_, i) => `<a href="/l${i}">Link ${i}</a>`).join("");
  const page = extractBrowserAgentPage(
    `<html><body>${anchors}<p>${"wort ".repeat(3000)}</p></body></html>`,
    "https://example.com",
  );
  assert.equal(page.links.length, 40);
  assert.ok(page.text.length <= 8000);
});

test("fetchBrowserAgentPage fetches and extracts a page via injected fetch", async () => {
  const calls: string[] = [];
  setBrowserAgentFetchForTests((async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response("<html><title>Testseite</title><body><a href='/x'>Ziel</a></body></html>", {
      status: 200,
    });
  }) as typeof fetch);
  try {
    const page = await fetchBrowserAgentPage("https://example.com/a");
    assert.equal(calls.length, 1);
    assert.equal(page.title, "Testseite");
    assert.equal(page.links[0]?.href, "https://example.com/x");
  } finally {
    setBrowserAgentFetchForTests();
  }
});

test("fetchBrowserAgentPage rejects http errors and oversized bodies", async () => {
  setBrowserAgentFetchForTests((async () => new Response("nein", { status: 403 })) as typeof fetch);
  try {
    await assert.rejects(() => fetchBrowserAgentPage("https://example.com"), /HTTP 403/);
  } finally {
    setBrowserAgentFetchForTests();
  }
  setBrowserAgentFetchForTests(
    (async () => new Response("x".repeat(3_000_001), { status: 200 })) as typeof fetch,
  );
  try {
    await assert.rejects(() => fetchBrowserAgentPage("https://example.com"), /zu gro/);
  } finally {
    setBrowserAgentFetchForTests();
  }
});

test("findAgentLink matches exact, partial and href-kebab", () => {
  const links = [
    { href: "https://example.com/sport-nachrichten", text: "Sport Nachrichten" },
    { href: "https://example.com/impressum", text: "Impressum" },
  ];
  assert.equal(findAgentLink(links, "Impressum")?.href, "https://example.com/impressum");
  assert.equal(findAgentLink(links, "nachrichten")?.href, "https://example.com/sport-nachrichten");
  assert.equal(
    findAgentLink(links, "sport nachrichten")?.href,
    "https://example.com/sport-nachrichten",
  );
  assert.equal(findAgentLink(links, "kontakt"), null);
});

test("findSiteSearchUrl builds a search url from the first GET form", () => {
  const page: BrowserAgentPage = {
    url: "https://example.com",
    title: "t",
    text: "",
    links: [],
    forms: [{ action: "https://example.com/suche", fieldName: "q" }],
  };
  assert.equal(findSiteSearchUrl(page, "hose"), "https://example.com/suche?q=hose");
  assert.equal(findSiteSearchUrl({ ...page, forms: [] }, "hose"), null);
});

test("runMiraSiteAction clicks links and runs site search via injected serve", async () => {
  const page: BrowserAgentPage = {
    url: "https://example.com",
    title: "Shop",
    text: "",
    links: [
      { href: "https://example.com/kontakt", text: "Kontakt" },
      { href: "https://example.com/angebote", text: "Angebote" },
    ],
    forms: [{ action: "https://example.com/suche", fieldName: "q" }],
  };
  setMiraBrowserAgentForTests(async () => page);
  try {
    const clicked = await runMiraSiteAction("klicke auf Kontakt", "https://example.com");
    assert.deepEqual(clicked, {
      kind: "navigated",
      url: "https://example.com/kontakt",
      label: "Kontakt",
    });
    const searched = await runMiraSiteAction(
      "suche auf der Seite nach schuhe",
      "https://example.com",
    );
    assert.deepEqual(searched, {
      kind: "search",
      url: "https://example.com/suche?q=schuhe",
      label: "Suche auf der Seite: schuhe",
    });
    const missing = await runMiraSiteAction("klicke auf Nichts", "https://example.com");
    assert.equal(missing.kind, "failed");
  } finally {
    setMiraBrowserAgentForTests();
  }
});

test("runMiraSiteAction fails gracefully when the page cannot be served", async () => {
  setMiraBrowserAgentForTests(async () => {
    throw new Error("offline");
  });
  try {
    const result = await runMiraSiteAction("klicke auf Kontakt", "https://example.com");
    assert.equal(result.kind, "failed");
    assert.match((result as { detail: string }).detail, /nicht geladen/);
  } finally {
    setMiraBrowserAgentForTests();
  }
});

test("responseBlocksFraming detects X-Frame-Options and CSP frame-ancestors (Alo 1.172)", () => {
  assert.equal(responseBlocksFraming(new Headers({ "x-frame-options": "DENY" })), true);
  assert.equal(responseBlocksFraming(new Headers({ "x-frame-options": "SAMEORIGIN" })), true);
  assert.equal(
    responseBlocksFraming(
      new Headers({ "content-security-policy": "default-src 'self'; frame-ancestors 'self'" }),
    ),
    true,
  );
  assert.equal(
    responseBlocksFraming(
      new Headers({ "content-security-policy": "default-src 'self'; frame-ancestors *" }),
    ),
    false,
  );
  assert.equal(responseBlocksFraming(new Headers()), false);
});

test("fetchBrowserAgentPage reports frameBlocked from response headers (Alo 1.172)", async () => {
  setBrowserAgentFetchForTests(
    (async () =>
      new Response("<html><title>Gesperrt</title><body><p>Text</p></body></html>", {
        status: 200,
        headers: { "x-frame-options": "SAMEORIGIN" },
      })) as typeof fetch,
  );
  try {
    const page = await fetchBrowserAgentPage("https://example.com");
    assert.equal(page.frameBlocked, true);
  } finally {
    setBrowserAgentFetchForTests();
  }
  setBrowserAgentFetchForTests(
    (async () =>
      new Response("<html><title>Offen</title><body><p>Text</p></body></html>", {
        status: 200,
      })) as typeof fetch,
  );
  try {
    const page = await fetchBrowserAgentPage("https://example.com");
    assert.equal(page.frameBlocked, false);
  } finally {
    setBrowserAgentFetchForTests();
  }
});

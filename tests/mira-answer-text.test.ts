import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiraAnswerText } from "../src/components/mira/MiraAnswerText.tsx";
import { parseMiraAnswer } from "../src/lib/mira-answer-markdown.ts";

test("Mira answer parser groups headings, lists, quotes, code and simple tables", () => {
  const blocks = parseMiraAnswer(
    [
      "# Kurzüberblick",
      "",
      "**Empfehlung:** ruhig starten.",
      "- Erstes Ziel",
      "- Nächster Schritt",
      "",
      "> Das bleibt ein Vorschlag.",
      "",
      "| Bereich | Status |",
      "| --- | --- |",
      "| Mira | bereit |",
      "",
      "```ts",
      "const safe = true;",
      "```",
    ].join("\n"),
  );

  assert.deepEqual(
    blocks.map((block) => block.type),
    ["heading", "paragraph", "list", "quote", "table", "code"],
  );
  assert.deepEqual(blocks[2], {
    type: "list",
    ordered: false,
    items: ["Erstes Ziel", "Nächster Schritt"],
  });
  assert.deepEqual(blocks[4], {
    type: "table",
    headers: ["Bereich", "Status"],
    rows: [["Mira", "bereit"]],
  });
});

test("visual answer markup remains semantic, mobile-scrollable and safe for untrusted text", () => {
  const html = renderToStaticMarkup(
    createElement(MiraAnswerText, {
      text: [
        "## Übersicht",
        "",
        "**Sicher** und `lesbar`.",
        "- Ein Punkt",
        "",
        "| Option | Wert |",
        "| --- | --- |",
        "| Layout | frei |",
        "",
        "[unsicher](javascript:alert(1))",
        "<script>alert(1)</script>",
      ].join("\n"),
    }),
  );

  assert.match(html, /<h4/);
  assert.match(html, /<strong>Sicher<\/strong>/);
  assert.match(html, /<ul/);
  assert.match(html, /<table/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|href="javascript:/i);
});

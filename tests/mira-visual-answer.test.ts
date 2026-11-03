import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiraVisualAnswerCard } from "../src/components/mira/MiraVisualAnswerCard.tsx";
import { parseAiResponse } from "../src/lib/ai-plan.ts";
import { getAloOwner, setAloOwner } from "../src/lib/alo-store.ts";
import { validateMiraVisualAnswer, type MiraVisualAnswer } from "../src/lib/mira-visual-answer.ts";
import { loadSessions, saveSessions, type AiSession } from "../src/lib/super-ai-tools.ts";

const metricGrid: MiraVisualAnswer = {
  type: "metricGrid",
  schemaVersion: 1,
  title: "Wochenüberblick",
  items: [
    { label: "Trainingstage", value: "3", detail: "diese Woche" },
    { label: "Ziel", value: "4 Tage" },
  ],
};

const barChart: MiraVisualAnswer = {
  type: "barChart",
  schemaVersion: 1,
  title: "Vergleich",
  unit: "km",
  items: [
    { label: "Weg A", value: 2.5 },
    { label: "Weg B", value: 5 },
  ],
};

function withStorage(initial: Record<string, string>, run: (storage: Map<string, string>) => void) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousOwner = getAloOwner();
  const storage = new Map(Object.entries(initial));
  setAloOwner(null);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    run(storage);
  } finally {
    setAloOwner(previousOwner);
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("Mira visual validator accepts only its exact finite versioned shapes", () => {
  assert.deepEqual(validateMiraVisualAnswer(metricGrid), metricGrid);
  assert.deepEqual(validateMiraVisualAnswer(barChart), barChart);
  assert.equal(validateMiraVisualAnswer({ ...metricGrid, schemaVersion: 2 }), null);
  assert.equal(validateMiraVisualAnswer({ ...metricGrid, type: "html" }), null);
  assert.equal(validateMiraVisualAnswer({ ...metricGrid, markup: "<script>bad</script>" }), null);
  assert.equal(
    validateMiraVisualAnswer({ ...metricGrid, title: "<img src=x onerror=alert(1)>" }),
    null,
  );
  assert.equal(validateMiraVisualAnswer({ ...metricGrid, title: "https://example.com" }), null);
  assert.equal(validateMiraVisualAnswer({ ...metricGrid, items: [metricGrid.items[0]] }), null);
  assert.equal(
    validateMiraVisualAnswer({
      ...metricGrid,
      items: [...metricGrid.items, ...metricGrid.items, ...metricGrid.items, metricGrid.items[0]],
    }),
    null,
  );
});

test("bar chart rejects unsafe units, non-finite, negative, oversized and over-precise values", () => {
  assert.equal(validateMiraVisualAnswer({ ...barChart, unit: "<script>" }), null);
  assert.equal(
    validateMiraVisualAnswer({
      ...barChart,
      items: [
        { label: "A", value: 1 },
        { label: "B", value: -1 },
      ],
    }),
    null,
  );
  assert.equal(
    validateMiraVisualAnswer({
      ...barChart,
      items: [
        { label: "A", value: 1 },
        { label: "B", value: 1_000_001 },
      ],
    }),
    null,
  );
  assert.equal(
    validateMiraVisualAnswer({
      ...barChart,
      items: [
        { label: "A", value: 1 },
        { label: "B", value: 1.234 },
      ],
    }),
    null,
  );
  assert.equal(
    validateMiraVisualAnswer({
      ...barChart,
      items: [
        { label: "A", value: 0 },
        { label: "B", value: 0 },
      ],
    }),
    null,
  );
  assert.equal(
    validateMiraVisualAnswer({
      ...barChart,
      items: [{ label: "A", value: 1, url: "javascript:alert(1)" }, barChart.items[1]],
    }),
    null,
  );
});

test("bar chart accepts decimal hundredths affected by binary floating-point precision", () => {
  for (const value of [1.15, 2.55, 0.29]) {
    const validated = validateMiraVisualAnswer({
      ...barChart,
      items: [
        { label: "Testwert", value },
        { label: "Vergleich", value: 3 },
      ],
    });
    assert.ok(validated, `${value} should be accepted with two decimal places`);
    assert.equal(validated.type, "barChart");
    if (validated.type === "barChart") assert.equal(validated.items[0]?.value, value);
  }
});

test("bar chart accepts integer, tenths and hundredths but rejects a third decimal", () => {
  for (const value of [1, 1.2, 1.23]) {
    assert.ok(
      validateMiraVisualAnswer({
        ...barChart,
        items: [
          { label: "Testwert", value },
          { label: "Vergleich", value: 3 },
        ],
      }),
      `${value} should be accepted`,
    );
  }
  for (const value of [1.001, 1.234, 2.555]) {
    assert.equal(
      validateMiraVisualAnswer({
        ...barChart,
        items: [
          { label: "Testwert", value },
          { label: "Vergleich", value: 3 },
        ],
      }),
      null,
      `${value} should be rejected because it has more than two decimal places`,
    );
  }
});

test("Mira keeps reply text when visuals are missing, unknown or invalid", () => {
  const plain = "Die Antwort bleibt als normaler Text erhalten.";
  assert.deepEqual(parseAiResponse(plain), { reply: plain, plan: null });
  assert.deepEqual(parseAiResponse(JSON.stringify({ reply: plain, visual: metricGrid })), {
    reply: plain,
    plan: null,
    visual: metricGrid,
  });
  for (const visual of [
    { ...metricGrid, type: "arbitraryComponent" },
    { ...metricGrid, items: [{ label: "only one", value: "1" }] },
    { type: "html", html: "<script>run()</script>" },
  ]) {
    assert.deepEqual(parseAiResponse(JSON.stringify({ reply: plain, visual })), {
      reply: plain,
      plan: null,
    });
  }
});

test("fixed card renders metric and chart shapes without interpreting model text as markup", () => {
  const metricsMarkup = renderToStaticMarkup(
    createElement(MiraVisualAnswerCard, { visual: metricGrid }),
  );
  assert.match(metricsMarkup, /Visualisierte Antwort: Wochenüberblick/);
  assert.match(metricsMarkup, /Trainingstage/);
  assert.match(metricsMarkup, />3<\/dd>/);
  assert.match(metricsMarkup, /diese Woche/);
  assert.match(metricsMarkup, /keine Live-Abfrage/);

  const chartMarkup = renderToStaticMarkup(
    createElement(MiraVisualAnswerCard, { visual: barChart }),
  );
  assert.match(chartMarkup, /role="img"/);
  assert.match(chartMarkup, /width:50%/);
  assert.match(chartMarkup, /5 km/);
  assert.doesNotMatch(`${metricsMarkup}${chartMarkup}`, /<script|<iframe|<img|href=|<svg/i);
  assert.equal(
    renderToStaticMarkup(
      createElement(MiraVisualAnswerCard, { visual: { ...metricGrid, type: "html" } }),
    ),
    "",
  );
});

test("validated visuals round-trip through the existing Mira local session store", () => {
  const session: AiSession = {
    id: "visual-answer-session",
    title: "Visualantwort",
    updatedAt: "2026-11-01T09:00:00Z",
    messages: [{ role: "assistant", content: "Hier ist die Übersicht.", visual: metricGrid }],
  };
  withStorage(
    {
      "super-ai-sessions-v2": JSON.stringify([session]),
      "super-ai-imported-classic-coach": "1",
    },
    (storage) => {
      const loaded = loadSessions();
      assert.deepEqual(loaded[0]?.messages[0]?.visual, metricGrid);
      saveSessions(loaded);
      assert.deepEqual(
        JSON.parse(storage.get("super-ai-sessions-v2") ?? "[]")[0]?.messages[0]?.visual,
        metricGrid,
      );
    },
  );
});

test("both Mira chat views pass optional visuals to the fixed component only", () => {
  const page = readFileSync(
    new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
    "utf8",
  );
  const card = readFileSync(
    new URL("../src/components/mira/MiraVisualAnswerCard.tsx", import.meta.url),
    "utf8",
  );
  const progressive = readFileSync(
    new URL("../src/components/mira/MiraProgressiveAnswer.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((page.match(/<MiraVisualAnswerCard/g) ?? []).length, 2);
  assert.match(page, /\.\.\.\(parsed\.visual \? \{ visual: parsed\.visual \} : \{\}\)/);
  assert.match(page, /<MiraProgressiveAnswer[\s\S]*?text=\{m\.content\}/);
  assert.match(progressive, /MiraAnswerText text=\{text\} \/>/);
  assert.match(card, /validateMiraVisualAnswer\(visual\)/);
  assert.doesNotMatch(card, /dangerouslySetInnerHTML|<iframe|<script|href=|fetch\(/i);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AloWebAppGuide } from "../src/components/AloWebAppGuide.tsx";

test("Alo web app guide is available as a compact, accessible in-app help section", () => {
  const html = renderToStaticMarkup(createElement(AloWebAppGuide));
  assert.match(html, /aria-label="Kurzanleitung für die Alo-Web-App"/);
  for (const topic of [
    "Startseite &amp; Bereiche",
    "Training &amp; Fortschritt",
    "Mira &amp; Datenfreigabe",
    "Nexus Chat",
    "Einstellungen &amp; Personalisierung",
    "Installieren, Hilfe &amp; Fehlerberichte",
  ]) {
    assert.ok(html.includes(topic), `missing help topic: ${topic}`);
  }
  assert.match(html, /sechs Designstile, 13 Farbwelten, vier Navigationslayouts/);
  assert.match(html, /nicht automatisch angehängt/);
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
});

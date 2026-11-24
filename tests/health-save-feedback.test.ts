import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync(
  new URL("../src/routes/_authenticated/health.tsx", import.meta.url),
  "utf8",
);

test("both Health design variants render the shared save feedback", () => {
  assert.equal((route.match(/<HealthSaveFeedback feedback=\{feedback\}/g) ?? []).length, 2);
});

test("manual saves distinguish full success, partial warning, and failure", () => {
  assert.match(route, /kind: profileWeightSaved \? "success" : "warning"/);
  assert.match(route, /kind: "error"/);
  assert.match(
    route,
    /Gesundheitsdaten gespeichert; Profilgewicht konnte nicht aktualisiert werden\./,
  );
  assert.match(route, /Speichern fehlgeschlagen\. Verbindung prüfen und erneut versuchen\./);
});

test("save feedback exposes polite status or assertive alert semantics and visible tone", () => {
  assert.match(route, /role=\{feedback\.kind === "error" \? "alert" : "status"\}/);
  assert.match(route, /aria-atomic="true"/);
  assert.match(route, /border-primary\/30 bg-primary\/5 text-primary/);
  assert.match(route, /border-amber-500\/30 bg-amber-500\/5 text-foreground/);
  assert.match(route, /border-destructive\/30 bg-destructive\/5 text-destructive/);
});

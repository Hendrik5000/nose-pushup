import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../src/components/MiraPowerPanel.tsx", import.meta.url),
  "utf8",
);

test("zehn Werkbank-Aufgaben bleiben in einer kompakten Auswahl statt zehn UI-Kacheln", () => {
  assert.match(panel, /Neue Werkbank · 10 Aufgaben/);
  assert.match(panel, /MIRA_WORKBENCH_TOOLS\.map/);
  assert.match(panel, /aria-label="Mira-Werkbank-Aufgabe"/);
  assert.match(panel, /aria-label="Mira-Werkbank-Quelle"/);
});

test("Werkbank verlangt den vollständigen, editierbaren Prompt vor einer einzelnen Anfrage", () => {
  assert.match(panel, /Exakten Mira-Werkbank-Prompt prüfen und bearbeiten/);
  assert.match(panel, /Exakten Prompt ansehen/);
  assert.match(panel, /An \{providerLabel \|\| "keinen Anbieter"\} senden · 1 Anfrage/);
  assert.match(panel, /preparedWorkbenchIsCurrent/);
});

test("mobile Aufgaben-, Quellen-, Sprach- und Promptfelder haben 16px Schrift und 44px Ziele", () => {
  for (const label of [
    'aria-label="Mira-Werkbank-Aufgabe"',
    'aria-label="Mira-Werkbank-Quelle"',
    'aria-label="Zielsprache für Mira-Übersetzung"',
    'aria-label="Exakten Mira-Werkbank-Prompt prüfen und bearbeiten"',
  ]) {
    const index = panel.indexOf(label);
    assert.notEqual(index, -1, `${label} is present`);
    assert.match(
      panel.slice(index, index + 400),
      label.includes("Prompt") ? /min-h-40/ : /min-h-11/,
    );
    assert.match(panel.slice(index, index + 400), /text-base/);
  }
  assert.match(panel, /className="flex min-h-11 w-full items-center justify-between/);
});

test("die separate Quelltext-Aufklappebene entfällt, da Quelle im Prompt geprüft wird", () => {
  assert.doesNotMatch(panel, /Ausgewählte Quelle ansehen/);
  assert.match(panel, /Exakter Prompt an \{providerLabel/);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  ALO_VERSION,
  ALO_VERSION_DATE,
  formatAloVersionDate,
  formatAloVersionLabel,
} from "../src/lib/alo-version";

test("Alo-Version hat das Format Major.Minor.Patch", () => {
  assert.match(ALO_VERSION, /^\d+\.\d+\.\d+$/);
});

test("Versionsdatum ist ein gültiges Datum im Format JJJJ-MM-TT", () => {
  assert.match(ALO_VERSION_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(ALO_VERSION_DATE)));
});

test("Datum wird als TT.MM.JJJJ formatiert", () => {
  assert.equal(formatAloVersionDate("2026-11-16"), "16.11.2026");
});

test("Ungültiges Datum bleibt unverändert", () => {
  assert.equal(formatAloVersionDate("morgen"), "morgen");
});

test("Versionsangabe ist lesbar", () => {
  assert.equal(formatAloVersionLabel("1.2.3", "2026-01-05"), "Alo 1.2.3 · Stand 05.01.2026");
  assert.match(formatAloVersionLabel(), /^Alo \d+\.\d+\.\d+ · Stand \d{2}\.\d{2}\.\d{4}$/);
});

test("Ungültige Version wird nicht ungeprüft angezeigt", () => {
  assert.equal(formatAloVersionLabel("v1", "2026-01-05"), "Alo unbekannt · Stand 05.01.2026");
});

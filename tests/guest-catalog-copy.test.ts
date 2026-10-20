import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("exercise cards explain when a best value has not been recorded", () => {
  const source = read("src/routes/_authenticated/exercises.tsx");
  assert.match(source, /Noch kein Bestwert/);
  assert.match(source, /best > 0/);
});

test("program cards describe concrete actions and distinguish duration from planned units", () => {
  const source = read("src/routes/_authenticated/programs.tsx");
  assert.equal((source.match(/triggerLabel="Programm speichern oder teilen"/g) ?? []).length, 4);
  assert.doesNotMatch(source, /Alo-Aktionen/);
  assert.match(source, /\{count\} Einheiten/);
  assert.match(source, /Wochenzahl = hinterlegte Laufzeit; Einheiten = gespeicherte Tagespläne/);
  assert.match(source, /advanced: "Fortgeschritten"/);
  assert.doesNotMatch(source, /advanced: "Profi"/);

  // Use the versioned seed, not a local-only fresh-migration review artifact.
  const seed = read("supabase/migrations/20260919121028_cd3168c5-90c2-47ad-8a69-5387fccb465f.sql");
  assert.match(seed, /\('pushup100', '100 Push-Ups', '[^']*', 6, 'advanced'/);
  assert.equal((seed.match(/\('pushup100', \d+,/g) ?? []).length, 7);
});

test("Health Connect explains manual-only entry and keeps implementation details disclosed", () => {
  const source = read("src/components/HealthConnectPanel.tsx");
  assert.match(
    source,
    /Ohne Android-App-Verbindung werden Werte nicht automatisch aus Health Connect übernommen/,
  );
  assert.match(source, /Werte speichern/);
  assert.match(source, /Technische Hinweise zur Verbindung/);
  const disclosureStart = source.indexOf("<details");
  const disclosureEnd = source.indexOf("</details>", disclosureStart);
  assert.ok(disclosureStart >= 0 && disclosureEnd > disclosureStart);
  const primaryUi = source.slice(0, disclosureStart);
  const technicalDetails = source.slice(disclosureStart, disclosureEnd);
  assert.doesNotMatch(
    primaryUi,
    /Native Bridge|TWA|window\.NosePushHealthConnect|direkter Lesezugriff/,
  );
  assert.match(technicalDetails, /window\.NosePushHealthConnect/);
  assert.match(source, /status\.hasBridge && \(/);
});

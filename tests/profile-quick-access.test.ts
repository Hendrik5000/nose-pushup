import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profile = readFileSync(
  new URL("../src/routes/_authenticated/profile-page-impl.tsx", import.meta.url),
  "utf8",
);

test("both profile designs explain the quick-access shortcuts and retain existing settings targets", () => {
  assert.equal((profile.match(/Schnellzugriff/g) ?? []).length, 2);
  assert.equal((profile.match(/aria-label="Profilbereiche"/g) ?? []).length, 2);
  for (const target of [
    '"#profile-training"',
    '"#appearance"',
    '"#profile-app"',
    '"#profile-history"',
  ]) {
    assert.ok(profile.includes(target), `missing settings shortcut target ${target}`);
  }
  assert.match(profile, /<AloWebAppGuide \/>/);
  assert.match(profile, /subtitle="Kurzanleitung & Tour"/);
  assert.doesNotMatch(profile, /className="-mt-4 text-xs text-muted-foreground"/);
  assert.match(
    profile,
    /Rubrik wählen, direkt springen und darunter nur den gewünschten Bereich öffnen\./,
  );
});

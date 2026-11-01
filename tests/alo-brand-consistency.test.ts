import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const root = new URL("../src/", import.meta.url);
const protectedPaths = new Set([
  "routes/_authenticated/workout.$exerciseId.tsx",
  "components/CoachPanel.tsx",
]);
function collectUiFiles(directory: string): string[] {
  return readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) return collectUiFiles(child);
    if (!/\.(tsx|ts)$/.test(entry.name)) return [];
    const rel = relative(
      new URL("../src/", import.meta.url).pathname,
      new URL(child, root).pathname,
    );
    return protectedPaths.has(rel) ? [] : [child];
  });
}

test("Alo UI uses current brand and German profile/series-protection wording", () => {
  const sourceFiles = [...collectUiFiles("routes"), ...collectUiFiles("components")];
  const outdatedUiCopy = [
    /Nosy Push-Ups/i,
    /— Nose Push/i,
    /ATHLETE CARD/i,
    /ATHLETE PROFILE/i,
    /Streak Freeze/i,
    /Freezes pro Monat/i,
    /Freeze aktiv/i,
    /Freeze für heute aktivieren/i,
  ];
  for (const file of sourceFiles) {
    const content = readFileSync(new URL(file, root), "utf8");
    for (const pattern of outdatedUiCopy) {
      assert.doesNotMatch(content, pattern, `${file} still contains ${pattern}`);
    }
  }
  const publicProfile = readFileSync(new URL("routes/u.$slug.tsx", root), "utf8");
  const seriesCard = readFileSync(new URL("components/StreakFreezeCard.tsx", root), "utf8");
  assert.match(publicProfile, /ÖFFENTLICHES TRAININGSPROFIL/);
  assert.match(seriesCard, /Serien-Schutz/);
  assert.match(seriesCard, /Schutz-Tage pro Monat/);
});

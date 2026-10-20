import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const profile = readFileSync(
  new URL("../src/routes/_authenticated/profile-page-impl.tsx", import.meta.url),
  "utf8",
);
const settingsSection = readFileSync(
  new URL("../src/components/SettingsSection.tsx", import.meta.url),
  "utf8",
);

test("profile shortcut fragments have targets in both rendered design variants", () => {
  for (const id of ["profile-training", "appearance", "profile-app", "profile-history"]) {
    assert.ok(profile.includes(`id="${id}"`), `missing fragment target: ${id}`);
  }
  assert.match(profile, /\["Training", "#profile-training"\]/);
  assert.match(profile, /\["Darstellung", "#appearance"\]/);
  assert.match(profile, /\["App & Datenschutz", "#profile-app"\]/);
  assert.match(profile, /\["Verlauf", "#profile-history"\]/);
  assert.match(settingsSection, /getClientRects\(\)\.length > 0/);
  assert.match(settingsSection, /target !== section/);
});

test("appearance fragments open the target, its collapsed ancestors, and nested design controls", () => {
  assert.match(settingsSection, /profile-section-reveal/);
  assert.match(settingsSection, /profile-appearance-reveal/);
  assert.match(settingsSection, /target\.contains\(section\)/);
  assert.match(
    settingsSection,
    /section\.dispatchEvent\(new CustomEvent\("profile-section-reveal", \{ bubbles: true \}\)\)/,
  );
});

test("failed or pending workout reads are not presented as an empty history", () => {
  assert.match(profile, /const \[workoutsLoading, setWorkoutsLoading\] = useState\(true\)/);
  assert.match(profile, /const \[workoutsError, setWorkoutsError\] = useState\(false\)/);
  assert.match(profile, /workoutResult\.error\) setWorkoutsError\(true\)/);
  assert.match(profile, /workoutsLoading \? \([\s\S]*?Trainings werden geladen/);
  assert.ok(profile.includes("Trainingsverlauf konnte nicht geladen werden."));
  assert.match(profile, /workouts\.length === 0 \? \([\s\S]*?Noch keine Trainings erfasst/);
});

test("profile history labels known units and leaves unknown units neutral", () => {
  assert.match(profile, /historyExercise\(w\.exercise_id\)\?\.unit === "seconds"/);
  assert.match(profile, /historyExercise\(w\.exercise_id\)\?\.unit === "reps"/);
  assert.equal((profile.match(/historyExercise\(w\.exercise_id\)/g) ?? []).length, 4);
});

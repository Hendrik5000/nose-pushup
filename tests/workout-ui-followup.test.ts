import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adjustManualCount, workoutBest } from "../src/lib/workout-ui.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("missing performance is not a personal zero; explicit measured zero stays real", () => {
  assert.equal(workoutBest("pushup", null, 0, null), null);
  assert.equal(workoutBest("squat", {}, 0, null), null);
  assert.equal(workoutBest("pushup", { pushup: 0 }, 0, null), 0);
  assert.equal(workoutBest("pushup", {}, 0, 0), 0);
  assert.equal(workoutBest("squat", {}, 0, 0), 0);
  assert.equal(workoutBest("pushup", {}, 20, 3), 20);
  assert.equal(workoutBest("squat", { squat: 12 }, 20, 5), 12);
});

test("manual plus/minus are bounded and treat typed zero as a value", () => {
  assert.equal(adjustManualCount("", 1), "1");
  assert.equal(adjustManualCount("0", 1), "1");
  assert.equal(adjustManualCount("1", -1), "0");
  assert.equal(adjustManualCount("0", -1), "0");
  assert.equal(adjustManualCount("1000", 1), "1000");
});

test("both manual layouts expose large, labelled controls and neutral save guidance", () => {
  const workout = read("routes/_authenticated/workout.$exerciseId.tsx");
  assert.match(workout, /Noch kein Bestwert/);
  assert.match(workout, /latestStatus === "empty"\s*\?\s*"Noch keine Erfassung"/);
  assert.equal((workout.match(/\{manualControls\}/g) ?? []).length, 2);
  assert.match(workout, /aria-label="Eine Wiederholung weniger"/);
  assert.match(workout, /aria-label="Eine Wiederholung mehr"/);
  assert.equal((workout.match(/min-h-14 min-w-14/g) ?? []).length, 2);
  assert.equal((workout.match(/\{manualHint\}/g) ?? []).length, 2);
  assert.match(workout, /Zum Speichern mindestens 1 Wiederholung eintragen/);
  assert.match(workout, /Einheit speichern/);
  assert.match(read("alo-mobile.css"), /> :is\(div, p\):not\(\.alo-manual-essential\)/);
  assert.match(workout, /alo-manual-essential mt-4 grid/);
  assert.doesNotMatch(workout, /"Training speichern"|Nosy Push-Ups|placeholder="0"/);
});

test("no-history coach names the lack of evidence and labels any entry plan as non-personal", () => {
  const coach = read("components/CoachPanel.tsx");
  assert.match(coach, /if \(workouts.length === 0\)/);
  assert.match(coach, /Unverbindlicher Startvorschlag/);
  assert.match(coach, /keine persönliche Empfehlung aus deinem Verlauf/);
  assert.match(coach, /keine persönliche Auswertung/);
  assert.doesNotMatch(coach, /label="Freezes"/);
});

test("AI coach checks actual workout history before any automatic advice call", () => {
  const ai = read("components/AiCoachCard.tsx");
  const guard = ai.indexOf("if (!hasWorkouts)");
  const call = ai.indexOf("await load(false)");
  assert.ok(guard > 0 && call > guard);
  assert.match(ai.slice(guard, call), /setLoading\(false\);\s*return;/);
  const guestGuard = ai.indexOf("if (isAnonymousCoachIdentity(u.user))");
  assert.ok(guestGuard > 0 && guestGuard < ai.indexOf('.from("workouts")'));
  assert.match(
    ai,
    /disabled=\{isGuest \|\| !hasHistory \|\| !canRefresh \|\| refreshing \|\| loading\}/,
  );
  assert.match(ai, /Unverbindlicher Startvorschlag/);
  assert.doesNotMatch(ai, /\}\)\(\);\s*load\(false\)/);
});

test("week plan reload wording does not promise regeneration or bypass the cache", () => {
  const plan = read("components/WeekPlanCard.tsx");
  assert.match(plan, /plan \? "Aktualisieren" : "Gespeicherten Plan laden"/);
  assert.match(plan, /title="Gespeicherten Wochenplan erneut laden"/);
  assert.match(plan, /load\(\{ data: \{ force: false \} \}\)/);
  assert.doesNotMatch(plan, />\s*Neu\s*</);
  assert.match(plan, /const mounted = useRef\(false\)/);
  assert.match(plan, /if \(isActive\(\)\) setLoading\(false\)/);
});

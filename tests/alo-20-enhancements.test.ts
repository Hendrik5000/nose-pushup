import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setAloOwner } from "../src/lib/alo-store.ts";
import {
  clearMood,
  filterWorkoutNotes,
  getMood,
  getWorkoutNotes,
  getWaterMl,
  MAX_WORKOUT_NOTE_LENGTH,
  parseWaterAmount,
  setMood,
  setWaterMl,
  undoWaterMl,
  updateWorkoutNote,
  type WorkoutNote,
} from "../src/lib/extra-features.ts";
import { onlyFavoriteExercises, searchExerciseCatalog } from "../src/lib/exercise-catalog.ts";
import {
  filterWorkoutHistory,
  formatWorkoutDaySummary,
  serializeWorkoutHistoryCsv,
  workoutHistoryStartDay,
  type HistoryWorkout,
} from "../src/lib/workout-history.ts";
import {
  adjustRestSeconds,
  resetRestSeconds,
  runRestCompletionOnce,
} from "../src/lib/rest-timer.ts";
import { serializeQuickCaptureText } from "../src/lib/quick-capture-export.ts";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function withStorage<T>(
  run: (data: Map<string, string>, failWrites: (fail: boolean) => void) => T,
): T {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const data = new Map<string, string>();
  let writesFail = false;
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (writesFail) throw new Error("quota exceeded");
        data.set(key, value);
      },
      removeItem: (key: string) => data.delete(key),
    },
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  setAloOwner(null);
  try {
    return run(data, (fail) => {
      writesFail = fail;
    });
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
    setAloOwner(null);
  }
}

const workout = (id: string, exercise_id: string, count: number): HistoryWorkout => ({
  id,
  created_at: "2026-11-07T12:00:00.000Z",
  exercise_id,
  count,
});

test("1. workout history offers tested 35- and 90-day local-date windows", () => {
  assert.equal(workoutHistoryStartDay(35, new Date("2026-11-08T12:00:00")), "2026-10-05");
  assert.equal(workoutHistoryStartDay(90, new Date("2026-11-08T12:00:00")), "2026-08-11");
  const ui = source("../src/components/WorkoutHistory.tsx");
  assert.match(ui, /Zeitraum für Trainingsverlauf/);
  assert.match(ui, /workoutHistoryStartDay\(rangeDays\)/);
});

test("2. workout history exercise filter retains only the requested exercise", () => {
  const rows = [workout("a", "pushup", 10), workout("b", "plank", 30)];
  assert.deepEqual(filterWorkoutHistory(rows, "plank"), [rows[1]]);
  assert.deepEqual(filterWorkoutHistory(rows, "all"), rows);
  assert.match(source("../src/components/WorkoutHistory.tsx"), /Trainings nach Übung filtern/);
});

test("3. CSV export quotes cells and neutralizes spreadsheet formula injection", () => {
  const csv = serializeWorkoutHistoryCsv([
    workout("a", '=HYPERLINK("https://example.invalid")', 4),
    { ...workout("bad", "pushup", 5), created_at: "not-a-date" },
  ]);
  assert.match(csv, /"Zeitpunkt","Übung","Anzahl","Einheit"/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example.invalid""\)"/);
  assert.equal(csv.split("\r\n").length, 2);
  assert.match(source("../src/components/WorkoutHistory.tsx"), /text\/csv;charset=utf-8/);
});

test("4. a day summary can be copied as a concise plain-text sentence", () => {
  const text = formatWorkoutDaySummary({
    day: "2026-11-08",
    exerciseId: "pushup",
    name: "Liegestütze",
    unit: "reps",
    sessions: 2,
    total: 42,
  });
  assert.match(text, /Liegestütze/);
  assert.match(text, /42 Wiederholungen/);
  assert.match(text, /2 Sessions/);
  assert.match(source("../src/components/WorkoutHistory.tsx"), /Tageszusammenfassung kopieren/);
});

test("5. a workout note is editable in place while preserving its ID and creation time", () => {
  withStorage((data) => {
    const note: WorkoutNote = { id: "note-1", text: "alt", ts: "2026-01-01T00:00:00.000Z" };
    data.set("np-workout-notes", JSON.stringify([note]));
    assert.equal(updateWorkoutNote("note-1", "  neu  "), true);
    const updated = getWorkoutNotes()[0];
    assert.equal(updated.id, note.id);
    assert.equal(updated.ts, note.ts);
    assert.equal(updated.text, "neu");
    assert.ok(updated.updatedAt);
    assert.match(
      source("../src/components/WorkoutNotesPanel.tsx"),
      /updateWorkoutNote\(id, editText\)/,
    );
  });
});

test("a failed local note write remains editable and is not reported as success", () => {
  withStorage((data, failWrites) => {
    data.set(
      "np-workout-notes",
      JSON.stringify([{ id: "note-quota", text: "original", ts: "2026-01-01T00:00:00.000Z" }]),
    );
    failWrites(true);
    assert.equal(updateWorkoutNote("note-quota", "edited"), false);
    assert.equal(getWorkoutNotes()[0].text, "original");
  });
  assert.match(source("../src/components/WorkoutNotesPanel.tsx"), /Notiz bleibt unverändert/);
});

test("6. note search is case-insensitive and keeps note records intact", () => {
  const notes: WorkoutNote[] = [
    { id: "1", text: "Plank heute", ts: "1" },
    { id: "2", text: "Liegestütze", ts: "2" },
  ];
  assert.deepEqual(filterWorkoutNotes(notes, "PLANK"), [notes[0]]);
  assert.deepEqual(filterWorkoutNotes(notes, "  "), notes);
  assert.match(source("../src/components/WorkoutNotesPanel.tsx"), /type="search"/);
});

test("7. workout note length is enforced at 500 characters with a visible counter", () => {
  assert.equal(MAX_WORKOUT_NOTE_LENGTH, 500);
  withStorage((data) => {
    data.set("np-workout-notes", JSON.stringify([{ id: "n", text: "x", ts: "1" }]));
    assert.equal(updateWorkoutNote("n", "x".repeat(501)), false);
    assert.equal(getWorkoutNotes()[0].text, "x");
  });
  const ui = source("../src/components/WorkoutNotesPanel.tsx");
  assert.match(ui, /maxLength=\{MAX_WORKOUT_NOTE_LENGTH\}/);
  assert.match(ui, /\{text\.length\}\/\{MAX_WORKOUT_NOTE_LENGTH\} Zeichen/);
});

test("8. a note copy action uses the system clipboard only after a user click", () => {
  const ui = source("../src/components/WorkoutNotesPanel.tsx");
  assert.match(ui, /navigator\.clipboard\.writeText\(noteText\)/);
  assert.match(ui, /aria-label="Notiz kopieren"/);
  assert.match(ui, /onClick=\{\(\) => void copyNote\(n\.text\)\}/);
});

test("9. older workout notes load in bounded pages instead of remaining hidden after eight", () => {
  const ui = source("../src/components/WorkoutNotesPanel.tsx");
  assert.match(ui, /const PAGE_SIZE = 8/);
  assert.match(ui, /count \+ PAGE_SIZE/);
  assert.match(ui, /Ältere Notizen laden/);
});

test("10. custom water amounts accept only whole values from 10 to 2,000 ml", () => {
  assert.equal(parseWaterAmount("350"), 350);
  for (const invalid of ["", "9", "2001", "1.5", "1e3", "-50", "abc"])
    assert.equal(parseWaterAmount(invalid), null);
  assert.match(source("../src/components/WaterTracker.tsx"), /Eigene ml/);
});

test("11. undo water removes only the last amount and never produces a negative total", () => {
  withStorage(() => {
    setWaterMl(600, "2026-11-08");
    assert.equal(undoWaterMl(250, "2026-11-08"), 350);
    assert.equal(undoWaterMl(1000, "2026-11-08"), 0);
    assert.equal(getWaterMl("2026-11-08"), 0);
  });
  assert.match(source("../src/components/WaterTracker.tsx"), /undoWaterMl\(lastAdded\)/);
});

test("12. water tracker explains how much remains to reach the existing daily goal", () => {
  const ui = source("../src/components/WaterTracker.tsx");
  assert.match(ui, /Tagesziel erreicht/);
  assert.match(ui, /ml bis zum Tagesziel/);
  assert.match(ui, /WATER_GOAL_ML - ml/);
});

test("13. mood check-in can remove only the requested local day's mood value", () => {
  withStorage(() => {
    setMood(4, "2026-11-07");
    setMood(2, "2026-11-08");
    assert.equal(clearMood("2026-11-08"), true);
    assert.equal(getMood("2026-11-08"), null);
    assert.equal(getMood("2026-11-07"), 4);
    assert.equal(clearMood("2026-11-08"), false);
  });
  assert.match(source("../src/components/MoodCheckin.tsx"), /Heutigen Eintrag entfernen/);
});

test("14. the training overview can show only locally favorited exercises", () => {
  const items = [
    { id: "pushup", name: "Push-Up" },
    { id: "plank", name: "Plank" },
  ];
  assert.deepEqual(onlyFavoriteExercises(items, ["plank"], true), [items[1]]);
  assert.deepEqual(onlyFavoriteExercises(items, ["plank"], false), items);
  assert.match(source("../src/components/TrainingDashboard.tsx"), /Nur Favoriten/);
});

test("15. exercise search matches names and descriptions without changing the catalog", () => {
  const items = [
    { id: "pushup", name: "Push-Up", description: "Brust und Arme" },
    { id: "plank", name: "Plank", description: "Core halten" },
  ];
  assert.deepEqual(searchExerciseCatalog(items, "ARME"), [items[0]]);
  assert.deepEqual(searchExerciseCatalog(items, "  "), items);
  assert.match(source("../src/routes/_authenticated/exercises.tsx"), /Übungen durchsuchen/);
});

test("16. rest timer can add a useful 30-second extension without changing the current pause", () => {
  assert.equal(adjustRestSeconds(40, 30), 70);
  assert.equal(adjustRestSeconds(40, 15), 55);
  assert.equal(adjustRestSeconds(5, -15), 0);
  assert.match(source("../src/components/SmartRestTimer.tsx"), /onClick=\{\(\) => extend\(30\)\}/);
});

test("17. the timer can restart from its current RPE/form recommendation", () => {
  assert.equal(resetRestSeconds(90.8), 90);
  assert.equal(resetRestSeconds(Number.NaN), 0);
  assert.match(source("../src/components/SmartRestTimer.tsx"), /setLeft\(suggestedSeconds\)/);
});

test("18. timer completion is announced through a polite status region", () => {
  const ui = source("../src/components/SmartRestTimer.tsx");
  assert.match(ui, /role="status"/);
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /aria-atomic="true"/);
  assert.match(ui, /Pause beendet\./);
});

test("19. timer completion callback, feedback and speech fire only once per run", () => {
  const guard = { current: false };
  let completions = 0;
  assert.equal(
    runRestCompletionOnce(guard, () => completions++),
    true,
  );
  assert.equal(
    runRestCompletionOnce(guard, () => completions++),
    false,
  );
  assert.equal(completions, 1);
  guard.current = false;
  assert.equal(
    runRestCompletionOnce(guard, () => completions++),
    true,
  );
  assert.equal(completions, 2);
});

test("20. QuickCapture exports only the user's visible text fields to a local TXT file", () => {
  const fields = {
    title: "Gedanke",
    text: "Daran weiterarbeiten",
    url: "https://example.invalid",
    attachment: "must not appear",
    accountId: "private-id",
  };
  const text = serializeQuickCaptureText(fields);
  assert.equal(text, "Gedanke\n\nDaran weiterarbeiten\n\nLink: https://example.invalid");
  assert.doesNotMatch(text, /private-id|must not appear/);
  assert.match(source("../src/components/alo/QuickCapture.tsx"), /Entwurf als TXT herunterladen/);
});

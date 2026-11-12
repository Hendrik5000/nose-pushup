import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const profile = read("routes/_authenticated/profile-page-impl.tsx");
const categoryRoute = read("routes/_authenticated/settings.$category.tsx");
const categoryRegistry = read("lib/profile-settings.ts");

test("category routes accept only declared settings pages and return safely to the hub", () => {
  assert.match(categoryRoute, /beforeLoad:[\s\S]*?isProfileSettingsCategory\(params\.category\)/);
  assert.match(categoryRoute, /throw redirect\(\{ to: "\/profile" \}\)/);
  assert.match(categoryRoute, /return <ProfilePage sectionId=\{category\} \/>/);
  assert.match(categoryRegistry, /value === "string"[\s\S]*?PROFILE_SETTINGS_CATEGORIES\.some/);
  assert.match(profile, /to="\/profile"[\s\S]*?aria-label="Zurück zu Einstellungen"/);
});

test("training records are fetched only for Training and Trainingsverlauf", () => {
  assert.match(
    profile,
    /const needsWorkouts = sectionId === "training" \|\| sectionId === "history"/,
  );
  assert.match(
    profile,
    /const profileRequest = needsWorkouts[\s\S]*?select\(PROFILE_TRAINING_COLS\)[\s\S]*?select\(PROFILE_SETTINGS_COLS\)/,
  );
  assert.match(profile, /const workoutRequest = needsWorkouts[\s\S]*?from\("workouts"\)/);
  assert.match(profile, /case "training":[\s\S]*?<CoachPanel[\s\S]*?workouts=\{workouts\}/);
  assert.match(profile, /case "history":[\s\S]*?Letzte Trainings/);
});

test("failed or pending workout reads are not presented as an empty history", () => {
  assert.match(profile, /const \[workoutsLoading, setWorkoutsLoading\] = useState\(true\)/);
  assert.match(profile, /const \[workoutsError, setWorkoutsError\] = useState\(false\)/);
  assert.match(profile, /workoutResult\?\.error/);
  assert.match(profile, /workoutsLoading \? \([\s\S]*?Trainings werden geladen/);
  assert.ok(profile.includes("Trainingsverlauf konnte nicht geladen werden."));
  assert.match(profile, /workouts\.length === 0 \? \([\s\S]*?Noch keine Trainings erfasst/);
});

test("settings profile queries do not load unrelated health and body-measurement fields", () => {
  assert.match(
    profile,
    /const PROFILE_SETTINGS_COLS =\s*"id, display_name, avatar_url, xp, current_streak, last_workout_date, share_activity, theme, sound_enabled, haptics_enabled"/,
  );
  assert.match(
    profile,
    /const PROFILE_TRAINING_COLS =\s*"id, display_name, avatar_url, xp, current_streak, last_workout_date, share_activity, theme, sound_enabled, haptics_enabled, best_count, longest_streak, streak_freezes"/,
  );
  assert.doesNotMatch(profile, /birth_year|height_cm|weight_kg|daily_goal/);
});

test("history labels known units and still deletes only the selected workout", () => {
  assert.match(profile, /historyExercise\(workout\.exercise_id\)\?\.unit === "seconds"/);
  assert.match(profile, /historyExercise\(workout\.exercise_id\)\?\.unit === "reps"/);
  assert.match(profile, /onClick=\{\(\) => props\.onDeleteWorkout\(workout\.id\)\}/);
  assert.match(profile, /aria-label=\{`Training vom/);
});

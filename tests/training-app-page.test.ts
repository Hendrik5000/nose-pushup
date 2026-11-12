import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const home = read("routes/_authenticated/index.tsx");
const route = read("routes/_authenticated/training.tsx");
const training = read("components/TrainingDashboard.tsx");
const routeTree = read("routeTree.gen.ts");

test("the Training/Gym app tile navigates to its own authenticated route, not a Home toggle", () => {
  assert.match(
    home.slice(home.indexOf("function buildHomeHubTiles"), home.indexOf("function HomeAppHub")),
    /id: "training"[\s\S]*?to: "\/training"/,
  );
  assert.match(home, /<Link to=\{to\} aria-label=\{`\$\{title\} öffnen`\}/);
  assert.match(route, /createFileRoute\("\/_authenticated\/training"\)/);
  assert.match(route, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.match(route, /<TrainingDashboard user=\{user\} \/>/);
  assert.match(
    routeTree,
    /id: '\/training',[\s\S]*?getParentRoute: \(\) => AuthenticatedRouteRoute/,
  );
  assert.doesNotMatch(
    home,
    /onOpenTrainingOverview|training-overview|HTMLDetailsElement|scrollIntoView/,
  );
});

test("Home has no duplicate or merely hidden training content, while Mira stays on Home", () => {
  assert.doesNotMatch(
    home,
    /TrainingDashboard|GymPartnerPanel|DashboardGrid|<details|useReadiness/,
  );
  assert.doesNotMatch(home, /\.from\("(?:workouts|health_entries|exercises)"\)/);
  assert.match(home, /<HomeAppHub[\s\S]*?<MiraOverlayLauncher \/>/);
  assert.doesNotMatch(training, /HomeAppHub|MiraOverlayLauncher|id="training-overview"/);
  assert.match(training, /<h1[^>]*>Trainingsübersicht & Gym<\/h1>/);
  assert.match(training, /<AloHomeLink \/>/);
});

test("the training app retains the existing plans, counting modes, widgets, history and Gym partners", () => {
  for (const component of [
    "GymPartnerPanel",
    "DashboardGrid",
    "ReadinessSummary",
    "WeekPlanCard",
    "WorkoutHistory",
    "WeeklyReview",
    "RecoveryCalendar",
    "MicroChallengeCard",
    "FavoriteStar",
  ]) {
    assert.ok(training.includes(`<${component}`), `${component} must remain in the training app`);
  }
  assert.match(training, /useReadiness\(\{ userId: user\.id, streak \}\)/);
  assert.match(training, /\.eq\("user_id", user\.id\)/);
  assert.match(training, /getDashboardRecommendation/);
  assert.match(training, /getQuickStartPlan/);
  assert.match(training, /to="\/workout\/\$exerciseId"/);
  for (const mode of ["nose", "manual", "camera"]) {
    assert.ok(training.includes(`setMode("${mode}")`));
  }
  assert.match(training, /routine\.sets/);
  assert.match(training, /routine\.reps/);
  assert.match(training, /routine\.rest/);
  assert.match(training, /classic-only/);
  assert.match(training, /sport-only/);
  assert.doesNotMatch(training, /localStorage\.(?:clear|removeItem)|\.delete\(/);
});

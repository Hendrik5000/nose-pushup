import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrainingWeekActivity } from "../src/components/TrainingWeekActivity";
import { getTrainingWeekDailyReps } from "../src/lib/training-dates.ts";
import test from "node:test";

const dashboard = readFileSync(
  resolve(process.cwd(), "src/routes/_authenticated/index.tsx"),
  "utf8",
);

test("weekly activity renders seven labeled days, highlights today, and marks open future days", () => {
  const days = getTrainingWeekDailyReps(
    [
      { count: 45, created_at: new Date(2024, 0, 8, 12).toISOString() },
      { count: 12, created_at: new Date(2024, 0, 9, 12).toISOString() },
    ],
    new Date(2024, 0, 10, 12),
  );
  const markup = renderToStaticMarkup(createElement(TrainingWeekActivity, { days, dailyGoal: 50 }));

  assert.match(markup, /aria-label="Trainingsaktivität je Wochentag"/);
  assert.equal((markup.match(/data-week-day=/g) ?? []).length, 7);
  assert.match(markup, /data-week-state="today"/);
  assert.match(markup, /Montag, 8\. Januar: 45 Wiederholungen/);
  assert.match(markup, /Mittwoch, 10\. Januar, heute: 0 Wiederholungen/);
  assert.match(markup, /Donnerstag, 11\. Januar: noch offen/);
  assert.match(markup, /„—“ = noch offen/);
});

test("dashboard builds daily bars from the same week query and leaves the aggregate intact", () => {
  assert.match(dashboard, /\.select\("count, created_at"\)/);
  assert.match(
    dashboard,
    /setWeekActivity\([\s\S]*?getTrainingWeekDailyReps\(workouts\.data \?\? \[\], now\)/,
  );
  assert.match(
    dashboard,
    /weekReps != null && <TrainingWeekActivity days=\{weekActivity\} dailyGoal=\{goal\} \/>/,
  );
  assert.match(dashboard, /aria-label="Wochenziel-Fortschritt"/);
  assert.match(dashboard, /\$\{weekReps\} \/ \$\{weeklyTarget\} Wiederholungen/);
});

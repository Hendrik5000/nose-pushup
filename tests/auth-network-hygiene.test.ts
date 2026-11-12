import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const authenticatedRoute = read("routes/_authenticated/route.tsx");
const authRoute = read("routes/auth.tsx");
const rootRoute = read("routes/__root.tsx");
const notificationsHook = read("hooks/useNotifications.ts");
const homeRoute = read("routes/_authenticated/index.tsx");
const readinessHook = read("hooks/useReadiness.ts");
const trainingRoute = read("routes/_authenticated/training.tsx");
const trainingDashboard = read("components/TrainingDashboard.tsx");
const miraPage = read("components/mira/SuperAiPage.tsx");
const miraRoute = read("routes/_authenticated/ai.tsx");
const coachRoute = read("routes/_authenticated/coach.tsx");

test("authenticated route uses its persisted client session for the UI gate", () => {
  assert.match(authenticatedRoute, /supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(authenticatedRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(authenticatedRoute, /useNotifications\(user\.id\)/);
  assert.match(authenticatedRoute, /catch\s*\{/);
});

test("sign-in redirect and optional root theme do not force auth user fetches", () => {
  assert.match(authRoute, /supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(authRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(rootRoute, /supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(rootRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(rootRoute, /Theme loading is optional/);
});

test("Home and the training app reuse the authenticated route user without extra user fetches", () => {
  assert.match(homeRoute, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.doesNotMatch(homeRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(trainingRoute, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.match(trainingRoute, /<TrainingDashboard user=\{user\} \/>/);
  assert.doesNotMatch(trainingDashboard, /supabase\.auth\.getUser\(\)/);
  assert.match(trainingDashboard, /useReadiness\(\{ userId: user\.id, streak \}\)/);
  assert.doesNotMatch(homeRoute, /useReadiness|\.from\("workouts"\)|\.from\("health_entries"\)/);
  assert.match(readinessHook, /userId: string/);
  assert.doesNotMatch(readinessHook, /supabase\.auth\.getUser\(\)/);
});

test("background notifications reuse the authenticated user id and contain transient request failures", () => {
  assert.match(notificationsHook, /useNotifications\(userId: string\)/);
  assert.doesNotMatch(notificationsHook, /supabase\.auth\.getUser\(\)/);
  assert.match(notificationsHook, /profileError \|\| statsError/);
  assert.match(notificationsHook, /best-effort/);
});

test("Mira and Coach reuse the authenticated route user instead of fetching it again", () => {
  assert.match(miraRoute, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.match(miraRoute, /<SuperAiPage sketchLayout userId=\{user\.id\} \/>/);
  assert.match(coachRoute, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.match(coachRoute, /<SuperAiPage userId=\{user\.id\} \/>/);
  assert.match(miraPage, /userId: string/);
  assert.doesNotMatch(miraPage, /supabase\.auth\.getUser\(\)/);
});

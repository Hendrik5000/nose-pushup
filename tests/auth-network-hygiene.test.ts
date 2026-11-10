import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const authenticatedRoute = read("routes/_authenticated/route.tsx");
const authRoute = read("routes/auth.tsx");
const rootRoute = read("routes/__root.tsx");
const notificationsHook = read("hooks/useNotifications.ts");

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

test("background notifications reuse the authenticated user id and contain transient request failures", () => {
  assert.match(notificationsHook, /useNotifications\(userId: string\)/);
  assert.doesNotMatch(notificationsHook, /supabase\.auth\.getUser\(\)/);
  assert.match(notificationsHook, /profileError \|\| statsError/);
  assert.match(notificationsHook, /best-effort/);
});

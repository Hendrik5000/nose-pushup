import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createCoachRequestGuard,
  isAnonymousCoachIdentity,
  isWithinCoachCooldown,
} from "../src/lib/coach-safety.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("only an explicitly anonymous Supabase identity is treated as a guest", () => {
  assert.equal(isAnonymousCoachIdentity({ is_anonymous: true }), true);
  assert.equal(isAnonymousCoachIdentity({ is_anonymous: false }), false);
  assert.equal(isAnonymousCoachIdentity({}), false);
  assert.equal(isAnonymousCoachIdentity(null), false);
  assert.equal(isAnonymousCoachIdentity("guest"), false);
});

test("cached advice remains inside cooldown regardless of client refresh intent", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");
  assert.equal(isWithinCoachCooldown("2026-10-20T11:30:00.000Z", now), true);
  assert.equal(isWithinCoachCooldown("2026-10-20T11:00:00.000Z", now), false);
  assert.equal(isWithinCoachCooldown("2026-10-20T12:01:00.000Z", now), true);
  assert.equal(isWithinCoachCooldown("not-a-date", now), false);
});

test("anonymous users are gated in the card and on the server before data or AI access", () => {
  const card = read("components/AiCoachCard.tsx");
  const advice = read("lib/coach.functions.ts");
  const weekPlan = read("lib/coach-plan.functions.ts");
  const guestGate = advice.indexOf("if (isAnonymousCoachIdentity(context.claims))");
  assert.notEqual(guestGate, -1);
  assert.ok(guestGate < advice.indexOf('.from("coach_advice")'));
  assert.ok(guestGate < advice.indexOf('fetch("https://ai.gateway.lovable.dev'));
  assert.match(
    card,
    /if \(isAnonymousCoachIdentity\(u\.user\)\)[\s\S]*?setLoading\(false\);\s*return;/,
  );
  assert.match(card, /isGuest \|\| \(!hasHistory && force\)/);
  assert.match(
    card,
    /Auch wenn auf diesem Gerät Trainings vorhanden sind, wird dafür keine KI-Anfrage/,
  );
  assert.match(weekPlan, /if \(isAnonymousCoachIdentity\(context\.claims\)\)/);
  assert.ok(
    weekPlan.indexOf("if (isAnonymousCoachIdentity(context.claims))") <
      weekPlan.indexOf('fetch("https://ai.gateway.lovable.dev'),
  );
});

test("force input cannot skip either server-side Coach cache", () => {
  const advice = read("lib/coach.functions.ts");
  const plan = read("lib/coach-plan.functions.ts");
  const adviceHandler = advice.slice(advice.indexOf(".handler("));
  const planHandler = plan.slice(plan.indexOf(".handler("));
  assert.doesNotMatch(adviceHandler, /data\.force/);
  assert.match(adviceHandler, /if \(last\)[\s\S]*?isWithinCoachCooldown\(/);
  assert.match(adviceHandler, /if \(cacheError\) throw/);
  assert.match(adviceHandler, /if \(profileError \|\| statsError\)/);
  assert.doesNotMatch(planHandler, /data\.force/);
  assert.match(planHandler, /if \(existing\)[\s\S]*?return \{/);
  assert.match(planHandler, /if \(planError\) throw/);
  assert.match(planHandler, /if \(profileError \|\| statsError\)/);
});

test("AI coach only labels history empty after successful auth and history reads", () => {
  const card = read("components/AiCoachCard.tsx");
  const historyError = card.indexOf("if (historyError)");
  const emptyHistory = card.indexOf("if (!hasWorkouts)");
  assert.match(card, /!loading && !error && !isGuest && !hasHistory/);
  assert.match(card, /error && !data &&/);
  assert.ok(historyError > 0 && historyError < emptyHistory);
  assert.match(card, /error: authError \} = await supabase\.auth\.getUser\(\)/);
  assert.match(card, /authError \|\| !u\.user/);
  assert.match(
    card,
    /catch \{[\s\S]*?setError\("Coach-Daten konnten nicht sicher geladen werden\."\)/,
  );
});

test("effect restarts cannot reactivate an old automatic or manual coach request", () => {
  let mounted = true;
  let generation = 0;
  const first = createCoachRequestGuard(
    () => mounted,
    () => generation,
  );
  const manual = createCoachRequestGuard(
    () => mounted,
    () => generation,
  );
  assert.equal(first(), true);
  mounted = false;
  generation += 1;
  assert.equal(first(), false);
  mounted = true;
  const restarted = createCoachRequestGuard(
    () => mounted,
    () => generation,
  );
  assert.equal(first(), false);
  assert.equal(manual(), false);
  assert.equal(restarted(), true);
  for (const path of ["components/AiCoachCard.tsx", "components/WeekPlanCard.tsx"]) {
    const source = read(path);
    assert.equal((source.match(/const isActive = createCoachRequestGuard\(/g) ?? []).length, 2);
    assert.match(source, /lifecycleGeneration\.current \+= 1/);
  }
});

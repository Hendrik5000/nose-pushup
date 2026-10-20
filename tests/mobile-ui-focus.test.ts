import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AloHeaderBrand } from "../src/components/AloHeaderBrand";
import {
  aloPageIdentity,
  chatRowSummary,
  priorityTasks,
  progressState,
  searchArea,
} from "../src/lib/alo-ui";
import type { AloRecord } from "../src/lib/alo-store";
const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const task = (id: string, body: Record<string, unknown>, deleted = false): AloRecord => ({
  id,
  kind: "task",
  body,
  deleted,
  dirty: true,
  revision: 0,
  updatedAt: "2026-10-19T12:00:00Z",
});
test("one Alo header gives every module, settings and training subpage an explicit identity", () => {
  assert.deepEqual(aloPageIdentity("/ai"), { title: "Mira", module: "Mira", back: "/" });
  assert.equal(aloPageIdentity("/chat").module, "Nexus");
  assert.equal(aloPageIdentity("/profile").title, "Einstellungen");
  assert.equal(aloPageIdentity("/workout/pushup").back, "/exercises");
  assert.equal(aloPageIdentity("/cali-workout/core").back, "/calisthenics");
  assert.equal(aloPageIdentity("/").back, null);
});
test("priority tasks prefer due dates, ignore done/deleted rows, and never mutate records", () => {
  const rows = [
    task("none", {}),
    task("future", { due: "2026-10-21T10:00:00Z" }),
    task("late", { due: "2026-10-18T10:00:00Z" }),
    task("done", { done: true }),
    task("deleted", {}, true),
    task("invalid", { due: "invalid" }),
  ];
  const original = JSON.stringify(rows);
  assert.deepEqual(
    priorityTasks(rows, 2).map((r) => r.id),
    ["late", "future"],
  );
  assert.equal(priorityTasks(rows, 0).length, 0);
  assert.equal(JSON.stringify(rows), original);
});
test("progress distinguishes loading, unavailable and unrecorded from a genuine recorded zero", () => {
  assert.equal(progressState(true, true, false, 0).label, "Wird geladen");
  assert.equal(progressState(false, false, false, 0).label, "Nicht verfügbar");
  assert.equal(progressState(false, true, false, 0).label, "Noch nicht erfasst");
  assert.deepEqual(progressState(false, true, true, 0), {
    value: "0",
    label: "Erfasst",
    measured: true,
  });
});
test("search filters include plans and notes without misclassifying other Alo content", () => {
  for (const source of ["Trainingsplan · privat", "Trainingsnotiz"])
    assert.equal(searchArea(source), "training");
  assert.equal(searchArea("Mira · Lokal"), "mira");
  assert.equal(searchArea("Nexus · Cloud"), "nexus");
  assert.equal(searchArea("Einstellungen"), "alo");
  assert.equal(searchArea("Sammlung"), "alo");
});
test("chat rows use the real latest timestamp and count only unread messages from other people", () => {
  const messages = [
    { content: "älter", user_id: "other", created_at: "2026-10-18T09:00:00Z" },
    { content: "neu", user_id: "other", created_at: "2026-10-19T09:00:00Z" },
    { content: "von mir", user_id: "me", created_at: "2026-10-19T10:00:00Z" },
  ];
  const original = JSON.stringify(messages);
  assert.equal(chatRowSummary(messages, "me", "2026-10-18T10:00:00Z").unread, 1);
  assert.equal(chatRowSummary(messages, "me").latest?.content, "von mir");
  assert.deepEqual(chatRowSummary([], "me"), { latest: null, unread: 0 });
  assert.equal(JSON.stringify(messages), original);
});
test("mobile UI has no persistent capture launcher, swipe hint, edge preview or source chip strip", () => {
  const workspace = read("components/alo/AloWorkspace.tsx");
  const shell = read("routes/_authenticated/route.tsx");
  assert.doesNotMatch(workspace, /className="alo-launcher"|className="alo-tabs"/);
  assert.doesNotMatch(shell, /alo-swipe-edge|Wischen: Nose/);
  assert.match(workspace, /alo-priority-cards/);
  assert.match(read("components/alo/MiraSources.tsx"), /aria-haspopup="dialog"/);
  assert.match(read("components/alo/RoomTools.tsx"), /Raumdetail auswählen/);
  const css = read("alo-mobile.css");
  assert.match(css, /max-width: 350px[\s\S]*?\.alo-progress-ring[\s\S]*?display: none/);
  assert.match(css, /\.sport-chat-composer[\s\S]*?position: static/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /--tw-translate-x: 0px !important/);
  assert.match(css, /--tw-translate-y: 0px !important/);
});
test("cloud room rows request an actual latest message and exact unread count, and are concurrency bounded", () => {
  const backend = read("lib/chat-backend.ts");
  const ui = read("components/chat/LocalChatShell.tsx");
  assert.match(backend, /loadRoomPreview[\s\S]*?count: "exact", head: true/);
  assert.match(backend, /loadRoomPreview[\s\S]*?\.limit\(1\)/);
  assert.match(ui, /Math.min\(4, rooms.length\)/);
  assert.match(ui, /viewingConversation[\s\S]*?if \(viewingConversation\)/);
  assert.match(ui, /unknownUnread/);
  assert.match(ui, /if \(!available\)/);
});
test("training focus is reversible and does not remove pause, correction or save logic", () => {
  const ui = read("routes/_authenticated/workout.$exerciseId.tsx");
  assert.match(ui, /data-training-focus=\{focused\}/);
  for (const action of [
    "Details anzeigen",
    "Fokusmodus",
    "Satz starten",
    "Fortsetzen",
    "Korrigieren −1",
    "Pausieren",
    "Satz speichern",
    "Teiltraining speichern",
  ])
    assert.ok(ui.includes(action), action);
  assert.match(ui, /alo-session-strip/);
});

test("Nexus keeps quick answers and message tools secondary and never invents a workout count", () => {
  const ui = read("components/chat/LocalChatShell.tsx");
  assert.match(ui, /details className="alo-chat-quick-options"/);
  assert.match(ui, /details className="alo-message-actions"/);
  assert.doesNotMatch(ui, /workoutShareTemplate\(todayReps \|\|/);
  assert.match(ui, /disabled=\{todayReps <= 0\}/);
  assert.match(
    read("components/SportAppHeader.tsx"),
    /className="sport-area-link"[\s\S]*?onClick=\{\(\) => setOpen\(false\)\}/,
  );
});

test("Alo uses the supplied wordmark and brand image without replacing the compact header", () => {
  assert.match(read("components/AloHeaderBrand.tsx"), /src="\/alo-wordmark\.png"/);
  assert.match(read("routes/__root.tsx"), /\/alo-brand\.jpg/);
  assert.match(read("routes/__root.tsx"), /\/alo-apple-touch-icon\.png/);
});

test("mobile review fixes preserve skill routing and constrain narrow controls without removing features", () => {
  const c = read("routes/_authenticated/calisthenics.tsx");
  assert.match(c, /to="\/cali-workout\/\$skillId"/);
  assert.match(c, /params=\{\{ skillId: dailyFocus\.skill\.id \}\}/);
  const css = read("alo-mobile.css");
  assert.match(css, /battle-join-row[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /run-metric-value[\s\S]*?overflow-wrap: anywhere/);
  assert.match(css, /cali-skill-card[\s\S]*?flex-wrap: wrap/);
  assert.match(css, /min-width: 44px[\s\S]*?min-height: 44px/);
  assert.match(
    css,
    /design-style-picker \[role="group"\][\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
  );
  const settings = read("routes/_authenticated/profile-page-impl.tsx");
  assert.equal((settings.match(/profileAppearance/g) ?? []).length, 2);
  assert.doesNotMatch(settings, /heading\.click\(\)/);
});

test("appearance deep links open idempotently and scroll only the visible design variant", () => {
  const section = read("components/SettingsSection.tsx");
  assert.match(section, /profileAppearance \? "appearance" : id/);
  assert.match(section, /setOpen\(true\)/);
  assert.match(section, /section\.getClientRects\(\)\.length > 0/);
  assert.match(section, /section\.scrollIntoView/);
  assert.doesNotMatch(
    read("alo-mobile.css"),
    /\[data-profile-appearance\] > div > div\s*\{\s*overflow: visible/,
  );
});

test("every app area shares the horizontal Alo brand and preserves all header controls", () => {
  const header = read("components/SportAppHeader.tsx");
  const brand = read("components/AloHeaderBrand.tsx");
  assert.match(header, /data-module=\{identity.module\}/);
  assert.match(header, /<AloHeaderBrand title=\{identity.title\} \/>/);
  assert.match(header, /className="alo-header-title alo-brand-lockup"/);
  assert.doesNotMatch(header, /alo-nexus|<small>|identity.module !== "Nexus"/);
  assert.match(brand, /className="alo-brand-mark"/);
  assert.match(brand, /src="\/alo-wordmark\.png" alt="Alo"/);
  assert.match(brand, /title !== "Alo" && <strong>\{title\}<\/strong>/);
  for (const [path, title] of [
    ["/", "Nose-Pushup"],
    ["/ai", "Mira"],
    ["/chat", "Nexus Chat"],
    ["/health", "Gesundheit"],
    ["/programs", "Programme"],
    ["/exercises", "Übungen"],
    ["/profile", "Einstellungen"],
  ]) {
    assert.equal(aloPageIdentity(path).title, title);
  }
  assert.equal(aloPageIdentity("/chat").back, "/");
  assert.match(header, /<ArrowLeft aria-hidden="true"/);
  assert.match(header, /aria-label="Alo Zentrale öffnen"/);
  assert.match(header, /aria-controls="sport-area-menu"/);
  const css = read("alo-mobile.css");
  const shared = css.slice(css.indexOf("/* Shared Alo app lockup:"));
  assert.match(shared, /grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(shared, /\.alo-brand-lockup\s*\{[^}]*flex-direction: row;[^}]*align-items: center/);
  assert.match(shared, /\.alo-brand-mark\s*\{[^}]*flex: 0 0 34px/);
  assert.match(
    shared,
    /\.alo-header-title\s+strong\s*\{[^}]*overflow: visible;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere/,
  );
  assert.doesNotMatch(shared, /data-module|display: none|(?:^|\n)\s*width: 0;/);
});

test("shared brand renders each area once and never duplicates the Alo umbrella name", () => {
  for (const title of [
    "Nose-Pushup",
    "Mira",
    "Nexus Chat",
    "Gesundheit",
    "Programme",
    "Übungen",
    "Einstellungen",
    "Training",
  ]) {
    const markup = renderToStaticMarkup(createElement(AloHeaderBrand, { title }));
    assert.equal((markup.match(/alt="Alo"/g) ?? []).length, 1);
    assert.ok(markup.includes(`<strong>${title}</strong>`));
  }
  const umbrella = renderToStaticMarkup(createElement(AloHeaderBrand, { title: "Alo" }));
  assert.equal((umbrella.match(/alt="Alo"/g) ?? []).length, 1);
  assert.doesNotMatch(umbrella, /<strong>/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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
  assert.match(read("components/SportAppHeader.tsx"), /src="\/alo-wordmark\.png"/);
  assert.match(read("routes/__root.tsx"), /\/alo-brand\.jpg/);
  assert.match(read("routes/__root.tsx"), /\/alo-apple-touch-icon\.png/);
});

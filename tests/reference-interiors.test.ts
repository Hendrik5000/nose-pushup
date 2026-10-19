import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SleepDebtCard } from "../src/components/SleepDebtCard";
import { loadSessions, saveSessions, type AiSession } from "../src/lib/super-ai-tools";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
const sample: AiSession = {
  id: "existing",
  title: "Mein Plan",
  updatedAt: "2026-10-19T12:00:00Z",
  messages: [{ role: "user", content: "Mein bisheriger Chat" }],
};
function withStorage(
  initial: Record<string, string>,
  run: (data: Map<string, string>) => void,
  blockedWrite = false,
) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const data = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (blockedWrite) throw Error("blocked");
          data.set(key, value);
        },
      },
    },
  });
  try {
    run(data);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("missing, zero-sentinel and invalid sleep do not imply measured good recovery", () => {
  for (const sleepMinutes of [[], [0, 0], [NaN, -20]]) {
    const html = renderToStaticMarkup(createElement(SleepDebtCard, { sleepMinutes }));
    assert.match(html, /Noch keine Schlafdaten/);
    assert.doesNotMatch(html, /Im grünen Bereich|0\.0 h/);
  }
  const measured = renderToStaticMarkup(
    createElement(SleepDebtCard, { sleepMinutes: [480, 0, 420] }),
  );
  assert.match(measured, /1\.0 h/);
  assert.match(measured, /2 erfasste Nächte/);
});

test("classic coach history imports once without replacing existing chats or deleting its source", () => {
  const legacy = JSON.stringify([
    { role: "user", content: "Alter Chat" },
    { role: "assistant", content: "Alter Plan", actions: ["Gespeichert"] },
  ]);
  withStorage(
    { "super-ai-sessions-v2": JSON.stringify([sample]), "coach-chat-v1": legacy },
    (storage) => {
      const imported = loadSessions();
      assert.equal(imported.length, 2);
      assert.equal(imported[0].id, "classic-coach-import");
      assert.deepEqual(imported[1], sample);
      assert.equal(storage.get("coach-chat-v1"), legacy);
      assert.deepEqual(loadSessions(), imported);
    },
  );
});

test("bad classic data and blocked import writes do not hide healthy current sessions", () => {
  withStorage(
    { "super-ai-sessions-v2": JSON.stringify([sample]), "coach-chat-v1": "not-json" },
    () => assert.deepEqual(loadSessions(), [sample]),
  );
  withStorage(
    {
      "super-ai-sessions-v2": JSON.stringify([sample]),
      "coach-chat-v1": JSON.stringify([{ role: "user", content: "Legacy" }]),
    },
    () => assert.ok(loadSessions().some((session) => session.id === sample.id)),
    true,
  );
});

test("importing into a full history does not silently discard a prior session", () => {
  const sessions = Array.from({ length: 12 }, (_, index) => ({ ...sample, id: `saved-${index}` }));
  withStorage(
    {
      "super-ai-sessions-v2": JSON.stringify(sessions),
      "coach-chat-v1": JSON.stringify([{ role: "user", content: "Legacy" }]),
    },
    () => {
      const imported = loadSessions();
      assert.equal(imported.length, 13);
      saveSessions(imported);
      assert.equal(loadSessions().length, 13);
      for (const session of sessions)
        assert.ok(loadSessions().some((current) => current.id === session.id));
    },
  );
});

test("performance coach shares the AI workspace while classic remains selectable", () => {
  assert.match(read("routes/_authenticated/coach.tsx"), /<SuperAiPage \/>/);
  assert.match(read("routes/_authenticated/coach.tsx"), /<DesignView variant="classic">/);
  assert.match(read("components/AiCoachCard.tsx"), /to="\/ai"/);
  assert.match(read("routes/_authenticated/ai.tsx"), /useState<SportAiView>\("chat"\)/);
  assert.match(read("routes/_authenticated/ai.tsx"), /sport-ai-chat-options/);
});

test("community identifies local storage and separates mobile list from conversation", () => {
  const chat = read("components/chat/LocalChatShell.tsx");
  assert.match(chat, /Kein Versand an andere Geräte/);
  assert.match(chat, /Community-Chats durchsuchen/);
  assert.match(chat, /community-show-list/);
  assert.match(chat, /Zur Chatliste/);
  assert.match(read("sport.css"), /sport-chat-app \.sport-chat-composer\s*\{\s*position: static;/);
});

test("navigation makes community explicit and offers a direct appearance shortcut", () => {
  assert.match(read("components/TopNav.tsx"), /label: "Community"/);
  assert.match(read("components/SportAppHeader.tsx"), /hash="appearance"/);
  assert.doesNotMatch(read("components/SportAppHeader.tsx"), /ArrowUpRight/);
  assert.match(read("components/SettingsSection.tsx"), /hashchange/);
  assert.match(
    read("sport.css"),
    /All four positions retain both an icon and complete labels at 320px/,
  );
});

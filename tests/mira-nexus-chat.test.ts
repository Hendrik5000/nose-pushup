import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMiraNexusHistory,
  loadMiraNexusThread,
  miraNexusErrorText,
  miraNexusThreadKey,
  miraNexusUnavailableText,
  saveMiraNexusThread,
} from "../src/lib/mira-nexus-chat";

test("mira nexus thread storage stays local per user and honest without window", () => {
  assert.equal(miraNexusThreadKey("user-1"), "alo-nexus-mira-thread:user-1");
  assert.deepEqual(loadMiraNexusThread(""), []);
  saveMiraNexusThread("", []);
  assert.deepEqual(loadMiraNexusThread("user-1"), []);
});

test("mira nexus history sends the last messages in order", () => {
  const history = buildMiraNexusHistory([
    { id: "1", role: "user", content: "Hallo Mira", at: "2026-11-16T10:00:00Z" },
    {
      id: "2",
      role: "assistant",
      content: "Hallo! Wie kann ich helfen?",
      at: "2026-11-16T10:00:05Z",
    },
    { id: "3", role: "user", content: "   ", at: "2026-11-16T10:00:10Z" },
  ]);
  assert.deepEqual(history, [
    { role: "user", content: "Hallo Mira" },
    { role: "assistant", content: "Hallo! Wie kann ich helfen?" },
  ]);
});

test("mira nexus answers stay honest without provider or on errors", () => {
  assert.match(miraNexusUnavailableText(), /Kein aktiver KI-Anbieter/);
  assert.match(miraNexusErrorText(), /gerade nicht antworten/);
});

test("the Nexus shell embeds Mira like a Meta AI assistant entry", () => {
  const root = process.cwd();
  const shell = readFileSync(resolve(root, "src/components/chat/LocalChatShell.tsx"), "utf8");
  assert.match(shell, /MiraNexusPanel/);
  assert.match(shell, /aria-label="Mira in Nexus öffnen"/);
  assert.match(shell, /Assistentin — direkt in Nexus fragen/);
  assert.match(shell, /if \(miraOpen\) return "Mira · Assistentin";/);
  assert.match(shell, /setMiraOpen\(true\)/);
  assert.match(shell, /setMiraOpen\(false\)/);
});

test("the Mira Nexus panel asks superAiChat and stays honest about limits", () => {
  const root = process.cwd();
  const panel = readFileSync(resolve(root, "src/components/chat/MiraNexusPanel.tsx"), "utf8");
  assert.match(panel, /useServerFn\(superAiChat\)/);
  assert.match(panel, /selectProvider\(loadProviders\(userId\), classifyTask\(text\)\)/);
  assert.match(panel, /miraNexusUnavailableText\(\)/);
  assert.match(panel, /miraNexusErrorText\(\)/);
  assert.match(panel, /aria-label="Nachricht an Mira in Nexus"/);
  assert.match(panel, /aria-label="Zurück zum Nexus Chat"/);
  assert.match(panel, /bleibt nur auf diesem Gerät/);
  assert.match(panel, /Mira denkt nach …/);
  assert.doesNotMatch(panel, /entry is MiraNexusMessage/);
});

test("mira nexus threads keep only validated visuals", () => {
  const validVisual = {
    type: "metricGrid",
    schemaVersion: 1,
    title: "Überblick",
    items: [
      { label: "Tage", value: "3" },
      { label: "Ziel", value: "4" },
    ],
  };
  const stored = [
    {
      id: "1",
      role: "assistant",
      content: "Mit Karte",
      at: "2026-11-16T10:00:00Z",
      visual: validVisual,
    },
    {
      id: "2",
      role: "assistant",
      content: "Kaputte Karte wird ehrlich verworfen",
      at: "2026-11-16T10:00:05Z",
      visual: { type: "iframe", src: "https://evil.example" },
    },
    {
      id: "3",
      role: "user",
      content: "Frage",
      at: "2026-11-16T10:00:10Z",
      visual: validVisual,
    },
  ];
  withStorage({ "alo-nexus-mira-thread:user-1": JSON.stringify(stored) }, () => {
    const loaded = loadMiraNexusThread("user-1");
    assert.equal(loaded.length, 3);
    assert.deepEqual(loaded[0]?.visual, validVisual);
    assert.equal(loaded[1]?.visual, undefined);
    assert.equal(loaded[2]?.visual, undefined);
  });
});

test("the Nexus Mira panel reuses the shared visual answer pipeline", () => {
  const root = process.cwd();
  const panel = readFileSync(resolve(root, "src/components/chat/MiraNexusPanel.tsx"), "utf8");
  assert.match(panel, /let systemExtra = MIRA_VISUAL_INSTRUCTIONS/);
  assert.match(panel, /systemExtra,/);
  assert.match(panel, /parseAiResponse\(res\.reply, \{ preserveCode: false \}\)/);
  assert.match(panel, /\.\.\.\(visual \? \{ visual \} : \{\}\)/);
  assert.match(panel, /m\.role === "assistant" && m\.visual && <MiraVisualAnswerCard/);
});

function withStorage(initial: Record<string, string>, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
  }
}

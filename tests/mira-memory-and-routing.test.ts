import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyTask,
  DEFAULT_PROVIDERS,
  describeProviderSelection,
  selectProvider,
} from "../src/lib/ai-providers.ts";
import {
  addMiraMemoryNote,
  clearMiraMemory,
  isMiraMemoryEnabled,
  loadMiraMemoryNotes,
  miraMemorySystemBlock,
  removeMiraMemoryNote,
  setMiraMemoryEnabled,
  suggestMemoryFromUserText,
} from "../src/lib/mira-memory.ts";
import { clearSensitiveClientStorage } from "../src/lib/sensitive-storage.ts";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(i: number) {
      return [...store.keys()][i] ?? null;
    },
    get length() {
      return store.size;
    },
  };
  (globalThis as { localStorage?: typeof localStorage; window?: { localStorage: typeof localStorage } }).localStorage =
    localStorage;
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = { localStorage };
  return store;
}

test("classifyTask routes science, creative, coding and vision", () => {
  assert.equal(classifyTask("Erkläre die Formel in dieser Physik-Studie"), "science");
  assert.equal(classifyTask("Schreib ein Gedicht über den Regen"), "creative");
  assert.equal(classifyTask("Dieser TypeScript-Bug in der API"), "coding");
  assert.equal(classifyTask("Was ist auf dem Foto?"), "vision");
  assert.equal(classifyTask("Hallo", { hasImage: true }), "vision");
  assert.equal(classifyTask("Wie war meine Woche?"), "stats_analysis");
});

test("selectProvider prefers provider that lists the task", () => {
  const providers = structuredClone(DEFAULT_PROVIDERS).map((p) => ({
    ...p,
    enabled: false,
    apiKey: "",
  }));
  const google = providers.find((p) => p.id === "google")!;
  google.enabled = true;
  google.apiKey = "k";
  google.tasks = ["vision", "creative"];
  const openai = providers.find((p) => p.id === "openai")!;
  openai.enabled = true;
  openai.apiKey = "k";
  openai.tasks = ["coding"];

  const visionSel = selectProvider(providers, "vision");
  assert.equal(visionSel.provider?.id, "google");
  assert.equal(visionSel.reason, "task_preference");
  assert.match(describeProviderSelection(visionSel, "vision"), /Bild verstehen/);

  const codeSel = selectProvider(providers, "coding");
  assert.equal(codeSel.provider?.id, "openai");
});

test("mira memory is off by default and only builds system block when enabled with notes", () => {
  installMemoryStorage();
  const uid = "user-test-1";
  assert.equal(isMiraMemoryEnabled(uid), false);
  assert.equal(miraMemorySystemBlock(uid), null);

  setMiraMemoryEnabled(true, uid);
  assert.equal(isMiraMemoryEnabled(uid), true);
  assert.equal(miraMemorySystemBlock(uid), null);

  const note = addMiraMemoryNote("Ich schreibe ein Buch über Radtour", uid);
  assert.ok(note);
  assert.equal(loadMiraMemoryNotes(uid).length, 1);
  const block = miraMemorySystemBlock(uid);
  assert.ok(block);
  assert.match(block!, /LANGZEIT-GEDÄCHTNIS/);
  assert.match(block!, /Radtour/);

  removeMiraMemoryNote(note!.id, uid);
  assert.equal(loadMiraMemoryNotes(uid).length, 0);
  clearMiraMemory(uid);
  assert.equal(isMiraMemoryEnabled(uid), false);
});

test("suggestMemoryFromUserText only suggests safe declarative facts", () => {
  assert.ok(suggestMemoryFromUserText("Ich wohne in Hamburg und plane eine Reise"));
  assert.equal(suggestMemoryFromUserText("Was soll ich trainieren?"), null);
  assert.equal(suggestMemoryFromUserText("Mein API-Key ist sk-test"), null);
});

test("clearSensitiveClientStorage removes mira memory keys", () => {
  const store = installMemoryStorage();
  setMiraMemoryEnabled(true, "u2");
  addMiraMemoryNote("Ich mag Jazz", "u2");
  assert.ok([...store.keys()].some((k) => k.includes("alo-mira-memory")));
  clearSensitiveClientStorage();
  assert.equal(
    [...store.keys()].some((k) => k.includes("alo-mira-memory")),
    false,
  );
});

test("memory panel component exists", () => {
  const panel = readFileSync(new URL("../src/components/MiraMemoryPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /Kontext-Gedächtnis/);
});

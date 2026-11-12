import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) =>
  readFileSync(new URL(`../src/components/${file}`, import.meta.url), "utf8");

test("community composer and chat controls have explicit accessible names", () => {
  const chat = read("chat/LocalChatShell.tsx");
  assert.match(chat, /placeholder=\{replyTo \? "Antwort…" : "Nachricht…"\}/);
  assert.match(chat, /aria-label="Nachricht in Nexus Chat"/);
  assert.match(chat, /aria-label="Nachrichten durchsuchen"/);
  assert.match(chat, /aria-label="Name für Direktnachricht"/);
  assert.match(chat, /aria-label="Neuen Raum erstellen"/);
});

test("local chat labels distinguish device-only chats and rooms from cloud mode", () => {
  const chat = read("chat/LocalChatShell.tsx");
  assert.match(chat, /mode === "local" \? "Lokale Chats" : "Chats"/);
  assert.match(chat, /mode === "local" \? "Lokale Räume" : "Räume"/);
  assert.match(chat, /Lokal auf diesem Gerät/);
});

test("new-room dialog has a labeled heading, Escape close, focus containment, and focus return", () => {
  const chat = read("chat/LocalChatShell.tsx");
  assert.match(
    chat,
    /role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?aria-labelledby="new-room-title"/,
  );
  assert.match(chat, /<h2 id="new-room-title"/);
  assert.match(chat, /aria-label="Name des neuen Raums"/);
  assert.match(
    chat,
    /event\.key === "Escape"[\s\S]*?setNewRoomOpen\(false\)[\s\S]*?newRoomTriggerRef\.current\?\.focus\(\)/,
  );
  assert.match(chat, /dialog\?\.querySelectorAll/);
  assert.match(chat, /newRoomTriggerRef\.current = event\.currentTarget/);
});

test("home hub exposes accessible tools, search and area navigation without the removed header menu", () => {
  const home = readFileSync(
    new URL("../src/routes/_authenticated/index.tsx", import.meta.url),
    "utf8",
  );
  const areas = readFileSync(
    new URL("../src/routes/_authenticated/areas.tsx", import.meta.url),
    "utf8",
  );
  const tools = readFileSync(
    new URL("../src/routes/_authenticated/tools.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /aria-label="Alo-Werkzeuge öffnen"/);
  assert.match(home, /aria-label="Überall suchen"/);
  assert.match(home, /to="\/tools"/);
  assert.match(home, /to="\/areas"/);
  assert.match(areas, /<nav[^>]*aria-label="Alle weiteren Alo-Bereiche"/);
  assert.match(areas, /<Link[\s\S]*?to=\{to\}/);
  assert.match(tools, /<nav[^>]*aria-label="Alo-Werkzeuge"/);
  assert.match(tools, /aria-label=\{`\$\{label\} öffnen`\}/);
  assert.match(tools, /className="group flex min-h-24/);
});

test("message submission only clears an unchanged draft after a successful post", () => {
  const chat = read("chat/LocalChatShell.tsx");
  assert.match(
    chat,
    /if \(!posted\)[\s\S]*?Nicht gesendet\. Entwurf und Antwort bleiben erhalten\./,
  );
  assert.match(chat, /draftRef\.current === submittedDraft/);
  assert.match(
    chat,
    /text === undefined[\s\S]*?setDraft\(""\)[\s\S]*?saveDraft\(userId, target\.kind, target\.id, ""\)/,
  );
  assert.match(chat, /if \(!userId \|\| !active \|\| sendingRef\.current\) return/);
});

test("cloud mode offers DMs only with accepted friends and keeps the local DM composer local", () => {
  const chat = read("chat/LocalChatShell.tsx");
  assert.match(chat, /mode !== "local"\) return;/);
  assert.match(chat, /mode === "local" \? \([\s\S]*?dmComposer[\s\S]*?<FriendDmPicker/);
  assert.doesNotMatch(chat, /Direktnachrichten sind derzeit nur lokal/);
  const features = read("chat/NexusFriendFeatures.tsx");
  assert.match(features, /loadFriendEntries/);
  assert.match(features, /openCloudDm/);
  assert.match(features, /aria-label="Bild senden"/);
});

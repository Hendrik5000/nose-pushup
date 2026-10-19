import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) =>
  readFileSync(new URL(`../src/components/${file}`, import.meta.url), "utf8");

test("community composer and chat controls have explicit accessible names", () => {
  const chat = read("chat/LocalChatShell.tsx");
  assert.match(chat, /placeholder=\{replyTo \? "Antwort…" : "Nachricht…"\}/);
  assert.match(chat, /aria-label="Nachricht an die Community"/);
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

test("sport navigation menu exposes its controlled panel and Escape returns focus", () => {
  const header = read("SportAppHeader.tsx");
  assert.match(header, /aria-expanded=\{open\}[\s\S]*?aria-controls="sport-area-menu"/);
  assert.match(
    header,
    /if \(event\.key === "Escape"\)[\s\S]*?setOpen\(false\)[\s\S]*?trigger\.current\?\.focus\(\)/,
  );
  assert.match(header, /<nav id="sport-area-menu"[^>]*aria-label="Alle Bereiche"/);
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

test("cloud mode explains that DMs are local-only and prevents cloud DM creation", () => {
  const chat = read("chat/LocalChatShell.tsx");
  assert.match(
    chat,
    /mode !== "local"[\s\S]*?Direktnachrichten sind derzeit nur lokal auf diesem Gerät verfügbar\./,
  );
  assert.match(
    chat,
    /mode === "local" \? \([\s\S]*?dmComposer[\s\S]*?Direktnachrichten sind derzeit nur lokal auf diesem Gerät verfügbar\./,
  );
});

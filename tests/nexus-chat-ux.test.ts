import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = process.cwd();
const shell = readFileSync(resolve(root, "src/components/chat/LocalChatShell.tsx"), "utf8");
const styles = readFileSync(resolve(root, "src/sport.css"), "utf8");

test("Nexus chat exposes compact, honest storage and draft status", () => {
  assert.match(shell, /className="alo-nexus-status"/);
  assert.match(shell, /Speicher- und Synchronisierungsstatus/);
  assert.match(shell, /Cloud-Chat/);
  assert.match(shell, /Nur auf diesem Gerät/);
  assert.match(shell, /getSyncState\(\)\.message/);
  assert.doesNotMatch(shell, /Nachrichten: \{mode === "supabase"/);
});

test("Nexus message groups and action controls remain accessible", () => {
  assert.match(shell, /alo-message-continuation/);
  assert.match(shell, /aria-label="Weitere Nachrichtenaktionen"/);
  assert.match(shell, /<span className="sr-only">Weitere Nachrichtenaktionen<\/span>/);
  assert.doesNotMatch(shell, /<summary>Nachrichtenaktionen<\/summary>/);
});

test("Nexus quick replies and composer keep compact touch-friendly controls", () => {
  assert.match(shell, /<span>Schnell senden<\/span>/);
  assert.match(styles, /\.alo-chat-quick-options > summary/);
  assert.match(styles, /position: sticky;/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

test("Nexus messaging, drafts, realtime, attachments, calls and Mira hooks are preserved", () => {
  for (const contract of [
    "postMessage(",
    "saveDraft(",
    "ALO_REMOTE_EVENT",
    "CallButtons",
    "AttachImageButton",
    "MiraNexusPanel",
    "reactToMessage(",
    "loadMessages(",
  ]) {
    assert.ok(shell.includes(contract), `Missing preserved chat contract: ${contract}`);
  }
});

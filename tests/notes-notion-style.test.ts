import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

test("QuickCapture looks like a Notion-style document editor", () => {
  const root = process.cwd();
  const capture = readFileSync(resolve(root, "src/components/alo/QuickCapture.tsx"), "utf8");
  assert.match(capture, /placeholder="Unbenannt"/);
  assert.match(capture, /text-2xl font-bold/);
  assert.match(capture, /border-0 bg-transparent/);
  assert.match(capture, /placeholder="Notiz schreiben \u2026"/);
  assert.match(capture, /aria-label="Ablage Titel"/);
  assert.match(capture, /aria-label="Ablage Text"/);
  assert.match(capture, /Entwurf als TXT herunterladen/);
});

test("Collections view uses a Notion-style sidebar and document cards", () => {
  const root = process.cwd();
  const workspace = readFileSync(resolve(root, "src/components/alo/AloWorkspace.tsx"), "utf8");
  assert.match(workspace, /aria-label="Notiz-Sammlungen"/);
  assert.match(workspace, /Alle Notizen/);
  assert.match(workspace, /aria-pressed=\{selected === c\.id\}/);
  assert.match(workspace, /Neue Sammlung \u2026/);
  assert.match(workspace, /rounded-xl border border-border\/60 bg-card\/60 p-5/);
  assert.match(workspace, /text-lg font-semibold/);
  assert.match(workspace, /aria-label=\{`Sammlung f\u00fcr \$\{String\(r\.body\.title\)\}`\}/);
  assert.match(workspace, /Ablage l\u00f6schen/);
  assert.match(workspace, /Sammlung entfernen/);
  assert.match(workspace, /Neue Sammlung/);
  assert.match(workspace, /alo-priority-cards/);
  assert.doesNotMatch(workspace, /className="alo-launcher"|className="alo-tabs"/);
});

test("the notes empty state and privacy wording stay honest", () => {
  const root = process.cwd();
  const workspace = readFileSync(resolve(root, "src/components/alo/AloWorkspace.tsx"), "utf8");
  assert.match(workspace, /Noch keine Inhalte\./);
  assert.match(workspace, /Keine automatische Freigabe an andere/);
  const capture = readFileSync(resolve(root, "src/components/alo/QuickCapture.tsx"), "utf8");
  assert.match(capture, /Privat f\u00fcr dein Konto\./);
  assert.match(capture, /In Schnellablage speichern/);
});

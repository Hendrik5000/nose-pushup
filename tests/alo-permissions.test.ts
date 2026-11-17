import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ALO_SENSITIVE_ACTION_PATTERNS,
  findSensitiveActionLabel,
  isSensitiveActionLabel,
} from "../src/lib/alo-permissions.ts";

test("sensitive action patterns are unique and labeled", () => {
  const labels = ALO_SENSITIVE_ACTION_PATTERNS.map((entry) => entry.label);
  assert.equal(new Set(labels).size, labels.length, "Kategorie-Labels müssen eindeutig sein.");
  for (const entry of ALO_SENSITIVE_ACTION_PATTERNS) {
    assert.ok(entry.label.length > 0, "Jedes Muster braucht ein Kategorie-Label.");
  }
});

test("recognizes sensitive action labels", () => {
  assert.equal(isSensitiveActionLabel("Konto löschen"), true);
  assert.equal(isSensitiveActionLabel("Abmelden"), true);
  assert.equal(isSensitiveActionLabel("Passwort ändern"), true);
  assert.equal(isSensitiveActionLabel("Freigabe widerrufen"), true);
  assert.equal(isSensitiveActionLabel("Zur Zahlung fortfahren"), true);
  assert.equal(findSensitiveActionLabel("Konto löschen"), "Löschen");
  assert.equal(findSensitiveActionLabel("Passwort ändern"), "Passwort");
});

test("benign action labels stay unsensitive", () => {
  assert.equal(isSensitiveActionLabel("Übungen öffnen"), false);
  assert.equal(isSensitiveActionLabel("Training starten"), false);
  assert.equal(isSensitiveActionLabel("Suche"), false);
  assert.equal(isSensitiveActionLabel("Nexus öffnen"), false);
  assert.equal(isSensitiveActionLabel(""), false);
});

test("Mira computer-use confirms sensitive clicks through the central layer", () => {
  const source = readFileSync(new URL("../src/lib/mira-computer-use.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ findSensitiveActionLabel \} from "@\/lib\/alo-permissions"/);
  assert.match(source, /confirmSensitive\?: MiraPointerConfirm/);
  assert.match(source, /findSensitiveActionLabel\(actionableLabel\)/);
  assert.match(source, /wurde nicht best\u00e4tigt/);
});

test("marketplace keeps its own stricter grant system for app actions", () => {
  const source = readFileSync(
    new URL("../src/lib/marketplace-runtime.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /grantedActionIds\?\.includes/);
  assert.match(source, /lokal nicht freigegeben/);
});

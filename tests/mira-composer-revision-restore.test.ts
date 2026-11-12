import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { restoreMiraComposerTextAfterFailure } from "../src/lib/mira-composer-submit";

const page = readFileSync(
  new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
  "utf8",
);

const submission = {
  activeSessionId: "chat-a",
  submittedSessionId: "chat-a",
  currentText: "",
  submittedText: "Gesendeter Entwurf",
  currentRevision: 8,
  submittedRevision: 8,
};

test("failed send restores the submitted draft when its session and revision are unchanged", () => {
  assert.equal(restoreMiraComposerTextAfterFailure(submission), "Gesendeter Entwurf");
});

test("parallel rewriting, even if erased back to empty, prevents stale restoration", () => {
  assert.equal(
    restoreMiraComposerTextAfterFailure({
      ...submission,
      currentText: "Neuer Text",
      currentRevision: 9,
    }),
    null,
  );
  assert.equal(
    restoreMiraComposerTextAfterFailure({ ...submission, currentText: "", currentRevision: 10 }),
    null,
  );
});

test("switching sessions prevents restoration", () => {
  assert.equal(
    restoreMiraComposerTextAfterFailure({ ...submission, activeSessionId: "chat-b" }),
    null,
  );
});

test("older callers without revision values retain the previous restore behavior", () => {
  const { currentRevision: _current, submittedRevision: _submitted, ...legacy } = submission;
  assert.equal(restoreMiraComposerTextAfterFailure(legacy), "Gesendeter Entwurf");
  assert.equal(
    restoreMiraComposerTextAfterFailure({ ...legacy, currentText: "Schon bearbeitet" }),
    null,
  );
});

test("both SuperAiPage submission failure paths compare composer revisions", () => {
  assert.equal((page.match(/submittedRevision: submittedComposerRevision/g) ?? []).length, 2);
  assert.equal((page.match(/currentRevision: inputRevisionRef\.current/g) ?? []).length, 2);
  assert.match(page, /inputRevisionRef\.current \+= 1;\s*inputRef\.current = next/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  captureMiraComposerTextForSubmission,
  restoreMiraComposerTextAfterFailure,
} from "../src/lib/mira-composer-submit";

const page = readFileSync(
  new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
  "utf8",
);

test("an accepted composer send clears the input and saved draft before async work", () => {
  assert.equal(
    captureMiraComposerTextForSubmission("  Meine Frage  ", undefined, false),
    "  Meine Frage  ",
  );
  assert.equal(captureMiraComposerTextForSubmission("Entwurf", "gesprochener Text", true), null);

  const pendingIndex = page.indexOf(
    "setPendingUserMessage({ sessionId: activeId, message: userMessage })",
  );
  const clearInputIndex = page.indexOf('setInput("");', pendingIndex);
  const clearDraftIndex = page.indexOf(
    'putAlo("draft", { target: "mira", text: "" }, miraDraftId(submissionSessionId));',
    clearInputIndex,
  );
  const firstAwaitIndex = page.indexOf("await readMiraAttachments(", clearDraftIndex);

  assert.ok(pendingIndex >= 0);
  assert.ok(clearInputIndex > pendingIndex);
  assert.ok(clearDraftIndex > clearInputIndex);
  assert.ok(firstAwaitIndex > clearDraftIndex);
});

test("successful completion does not clear text typed after the submitted question", () => {
  const sendIndex = page.indexOf("const res = await send({");
  const catchIndex = page.indexOf("} catch (e) {", sendIndex);
  const success = page.slice(sendIndex, catchIndex);

  assert.ok(sendIndex >= 0 && catchIndex > sendIndex);
  assert.match(success, /setMessages\(\[[\s\S]*?\.\.\.nextMsgs,[\s\S]*?role: "assistant"/);
  assert.doesNotMatch(success, /setInput\(/);
  assert.match(success, /if \(!options\.preserveComposer\) setAttachments\(\[\]\)/);
});

test("a failed send restores the submitted text only into an empty composer in the same chat", () => {
  const args = {
    activeSessionId: "chat-a",
    submittedSessionId: "chat-a",
    currentText: "",
    submittedText: "Meine Frage",
  };
  assert.equal(restoreMiraComposerTextAfterFailure(args), "Meine Frage");
  assert.equal(restoreMiraComposerTextAfterFailure({ ...args, currentText: "Neuer Text" }), null);
  assert.equal(restoreMiraComposerTextAfterFailure({ ...args, activeSessionId: "chat-b" }), null);

  const catchIndex = page.indexOf("} catch (e) {");
  const finallyIndex = page.indexOf("} finally {", catchIndex);
  const failure = page.slice(catchIndex, finallyIndex);
  assert.match(
    failure,
    /restoreMiraComposerTextAfterFailure\(\{[\s\S]*?activeSessionId: activeIdRef\.current/,
  );
  assert.match(
    failure,
    /if \(restoredComposerText !== null\) \{[\s\S]*?setInput\(restoredComposerText\)/,
  );
  assert.match(failure, /putAlo\([\s\S]*?text: restoredComposerText/);
});

test("new typing stays editable during the pending reply and prevents stale restoration", () => {
  const args = {
    activeSessionId: "chat-a",
    submittedSessionId: "chat-a",
    currentText: "",
    submittedText: "Frühere Frage",
  };
  assert.equal(
    restoreMiraComposerTextAfterFailure({ ...args, currentText: "Neuer Entwurf" }),
    null,
  );
  assert.equal(restoreMiraComposerTextAfterFailure({ ...args, currentText: " " }), null);
  assert.match(page, /inputRef\.current = next;\s*setInputState\(next\)/);

  const classicComposer = page.slice(
    page.indexOf("className={`mira-classic-composer-form"),
    page.indexOf("</form>", page.indexOf("className={`mira-classic-composer-form")),
  );
  const sportComposer = page.slice(
    page.indexOf("className={`sport-chat-composer"),
    page.indexOf("</form>", page.indexOf("className={`sport-chat-composer")),
  );
  assert.ok(classicComposer.length > 0 && sportComposer.length > 0);
  const classicTextareaStart = classicComposer.indexOf("<textarea");
  const classicTextareaEnd = classicComposer.indexOf("/>", classicTextareaStart);
  const sportTextareaStart = sportComposer.indexOf("<textarea");
  const sportTextareaEnd = sportComposer.indexOf("/>", sportTextareaStart);
  const classicTextarea = classicComposer.slice(classicTextareaStart, classicTextareaEnd);
  const sportTextarea = sportComposer.slice(sportTextareaStart, sportTextareaEnd);
  assert.ok(classicTextareaStart >= 0 && sportTextareaStart >= 0);
  assert.doesNotMatch(classicTextarea, /disabled=\{loading\}/);
  assert.doesNotMatch(sportTextarea, /disabled=\{loading\}/);
});

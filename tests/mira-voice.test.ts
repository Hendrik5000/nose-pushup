import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getMiraSpeechSettings, prepareMiraSpeechText } from "../src/lib/mira-voice";

test("Mira-Antworten werden für das Vorlesen von Markdown und URLs bereinigt", () => {
  assert.equal(
    prepareMiraSpeechText(
      "## Hallo\n\n**Ruhig** sprechen und [hier](https://example.com) nachsehen.\n\n```js\nalert(1)\n```",
    ),
    "Hallo\n\nRuhig sprechen und hier nachsehen.",
  );
});

test("Vorlesestimme bevorzugt Deutsch und nutzt ein sanft langsameres Tempo", () => {
  const german = { lang: "de-DE" } as SpeechSynthesisVoice;
  const otherGerman = { lang: "de-AT" } as SpeechSynthesisVoice;
  const english = { lang: "en-US" } as SpeechSynthesisVoice;

  assert.equal(getMiraSpeechSettings([english, otherGerman, german]).voice, german);
  assert.equal(getMiraSpeechSettings([english, otherGerman]).voice, otherGerman);
  assert.equal(getMiraSpeechSettings([english]).voice, null);
  assert.deepEqual(
    (({ lang, rate, pitch, volume }) => ({ lang, rate, pitch, volume }))(
      getMiraSpeechSettings([german]),
    ),
    { lang: "de-DE", rate: 0.9, pitch: 0.98, volume: 0.92 },
  );
});

test("Sprachdialog hält den Text editierbar und sendet ihn nicht selbst", () => {
  const dialog = readFileSync("src/components/mira/MiraVoiceChatDialog.tsx", "utf8");
  const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
  const submitStart = page.indexOf("const submit = async");
  const regenerateStart = page.indexOf("const regenerate =", submitStart);
  const submitHandler = page.slice(submitStart, regenerateStart);

  assert.equal((page.match(/aria-label="Sprachdialog mit Mikrofon öffnen"/g) ?? []).length, 2);
  assert.doesNotMatch(page, /onClick=\{toggleVoice\}/);
  assert.match(dialog, /Erkannten Text bearbeiten/);
  assert.match(dialog, /Mira wird nicht automatisch kontaktiert/);
  assert.doesNotMatch(dialog, /onSubmit|superAiChat|submit\(/);
  assert.doesNotMatch(submitHandler, /speechSynthesis|speakMiraMessage/);
});

test("Sprachausgabe startet nur über eine Antwortaktion und lässt sich abbrechen", () => {
  const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
  assert.match(page, /onClick=\{\(\) => speakMiraMessage\(i, m\.content\)\}/);
  assert.match(page, /window\.speechSynthesis\.cancel\(\)/);
  assert.match(page, /Spracherkennung wird in diesem Browser nicht unterstützt/);
  assert.match(page, /Mikrofonzugriff wurde nicht erlaubt/);
});

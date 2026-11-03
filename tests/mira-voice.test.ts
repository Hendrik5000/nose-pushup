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
  const submitEnd = page.indexOf("const messagesRef = useRef(messages);", submitStart);
  const submitHandler = page.slice(submitStart, submitEnd);
  const classicStart = page.indexOf("mira-classic-composer-form");
  const classicFormStart = page.lastIndexOf("<form", classicStart);
  const classicEnd = page.indexOf("</form>", classicStart);
  const classicComposer = page.slice(classicFormStart, classicEnd);
  const sportStart = page.indexOf("className={`sport-chat-composer");
  const sportFormStart = page.lastIndexOf("<form", sportStart);
  const sportEnd = page.indexOf("</form>", sportStart);
  const sportComposer = page.slice(sportFormStart, sportEnd);
  const styles = readFileSync("src/mira-home-overlay.css", "utf8");
  const attachments = readFileSync("src/components/mira/MiraAttachments.tsx", "utf8");

  assert.equal((page.match(/aria-label="Diktierfunktion öffnen"/g) ?? []).length, 2);
  for (const composer of [classicComposer, sportComposer]) {
    assert.match(composer, /aria-label="Freisprechgespräch mit Mira öffnen"/);
    assert.match(composer, /aria-label="Diktierfunktion öffnen"/);
    assert.match(composer, /handleVoiceConversationOpenChange\(true\)/);
    assert.match(composer, /handleVoiceChatOpenChange\(true\)/);
    assert.match(composer, /<MiraAttachmentPicker/);
    assert.match(composer, /void submit\(\)/);
  }
  assert.match(styles, /border-radius: 9999px !important/);
  assert.match(attachments, /Foto aufnehmen/);
  assert.match(attachments, /Mediathek/);
  assert.match(attachments, /Dateien vom Gerät/);
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

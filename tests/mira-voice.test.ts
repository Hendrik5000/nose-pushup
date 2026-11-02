import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getMiraSpeechSettings,
  isMiraVoiceInterruption,
  isLikelyMiraSpeechEcho,
  prepareMiraSpeechText,
  primeMiraSpeechForUserGesture,
  resolveMiraVoiceTurnTranscript,
} from "../src/lib/mira-voice";

test("Mira-Antworten werden für das Vorlesen von Markdown und URLs bereinigt", () => {
  assert.equal(
    prepareMiraSpeechText(
      "## Hallo\n\n**Ruhig** sprechen und [hier](https://example.com) nachsehen.\n\n```js\nalert(1)\n```",
    ),
    "Hallo.\n\nRuhig sprechen und hier nachsehen.",
  );
});

test("Vorlesestimme bevorzugt die deutsche Standardstimme mit natürlicherem Tempo", () => {
  const german = { lang: "de-DE" } as SpeechSynthesisVoice;
  const otherGerman = { lang: "de-AT" } as SpeechSynthesisVoice;
  const english = { lang: "en-US" } as SpeechSynthesisVoice;
  const defaultGerman = { lang: "de-AT", default: true } as SpeechSynthesisVoice;

  assert.equal(getMiraSpeechSettings([english, otherGerman, german]).voice, german);
  assert.equal(getMiraSpeechSettings([english, otherGerman]).voice, otherGerman);
  assert.equal(getMiraSpeechSettings([german, defaultGerman]).voice, defaultGerman);
  assert.equal(getMiraSpeechSettings([english]).voice, null);
  assert.deepEqual(
    (({ lang, rate, pitch, volume }) => ({ lang, rate, pitch, volume }))(
      getMiraSpeechSettings([german]),
    ),
    { lang: "de-DE", rate: 0.97, pitch: 1, volume: 0.96 },
  );
});

test("Erkennt Miras akustisches Echo, lässt klare Stoppwörter aber als Unterbrechung durch", () => {
  const answer = "Gern helfe ich dir dabei. Welche Frage möchtest du zuerst klären?";
  assert.equal(isLikelyMiraSpeechEcho("Gern helfe ich", answer), true);
  assert.equal(isLikelyMiraSpeechEcho("Welche Frage?", answer), true);
  assert.equal(isLikelyMiraSpeechEcho("stopp", "Sag bitte stopp, wenn du etwas brauchst."), false);
  assert.equal(isLikelyMiraSpeechEcho("Ich möchte etwas fragen", answer), false);
});

test("Unterbrechungen stoppen auch mit einem klaren Einzelwort und Zwischenresultate bleiben sendbar", () => {
  assert.equal(isMiraVoiceInterruption("Stopp!"), true);
  assert.equal(isMiraVoiceInterruption("Ich habe eine Frage"), true);
  assert.equal(isMiraVoiceInterruption("Vielleicht"), false);
  assert.equal(
    resolveMiraVoiceTurnTranscript("  Finale Erkennung  ", "Zwischenresultat"),
    "Finale Erkennung",
  );
  assert.equal(
    resolveMiraVoiceTurnTranscript("", "Ich möchte etwas fragen"),
    "Ich möchte etwas fragen",
  );
  assert.equal(resolveMiraVoiceTurnTranscript("", "Vielleicht"), "");
  assert.equal(resolveMiraVoiceTurnTranscript("", "warte"), "warte");
});

test("iPhone-Safari-TTS wird im ausdrücklichen Start-Tipp lautlos aktiviert", () => {
  const events: string[] = [];
  let generatedText = "";
  const silentUtterance = { volume: 1, rate: 1 };

  primeMiraSpeechForUserGesture(
    {
      speak: (utterance) => {
        events.push("speak");
        assert.equal(utterance, silentUtterance);
      },
      resume: () => events.push("resume"),
    },
    (text) => {
      generatedText = text;
      return silentUtterance;
    },
  );

  assert.equal(generatedText, " ");
  assert.equal(silentUtterance.volume, 0);
  assert.equal(silentUtterance.rate, 10);
  assert.deepEqual(events, ["speak", "resume"]);

  let spokenWithoutResume = false;
  primeMiraSpeechForUserGesture({ speak: () => (spokenWithoutResume = true) }, () => ({
    volume: 1,
    rate: 1,
  }));
  assert.equal(spokenWithoutResume, true);
});

test("Sprachdialog hält den Text editierbar und sendet ihn nicht selbst", () => {
  const dialog = readFileSync("src/components/mira/MiraVoiceChatDialog.tsx", "utf8");
  const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
  const submitStart = page.indexOf("const submit = async");
  const speechHelperStart = page.indexOf("const speakMiraResponse =", submitStart);
  const submitHandler = page.slice(submitStart, speechHelperStart);

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

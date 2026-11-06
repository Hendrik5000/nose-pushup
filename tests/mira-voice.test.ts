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

test("Mikrofonklick und Composer-Halten nutzen denselben editierbaren Push-to-talk-Modus", () => {
  const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
  const controller = readFileSync("src/lib/mira-inline-dictation.ts", "utf8");
  assert.equal((page.match(/<MiraInlineDictationControls/g) ?? []).length, 2);
  assert.equal((page.match(/onClick=\{startInlineDictation\}/g) ?? []).length, 2);
  assert.equal((page.match(/onPointerDown=\{handleComposerPointerDown\}/g) ?? []).length, 2);
  assert.match(page, /new MiraComposerPressAndHold/);
  assert.match(controller, /private readonly delayMs = 300/);
  assert.match(controller, /if \(shouldStop\) this\.onStop\(\)/);
  assert.match(page, /"Nur zu, ich höre zu…"/);
  assert.match(page, /Diktat abbrechen/);
  assert.match(page, /Diktat übernehmen/);
  assert.match(page, /aria-label="Nachricht senden"/);
  assert.doesNotMatch(page, /MiraVoiceChatDialog|Entwurf im Chat ansehen|toggleVoice/);
  assert.doesNotMatch(controller, /submit\(|sendTranscript|fetch\(/);
  assert.match(controller, /recognition\.lang = "de-DE"/);
  assert.match(controller, /recognition\.abort\(\)/);
});

test("Mikrofon- und Browser-Spracherkennungsdetails stehen in Mira-Einstellungen, nicht in einem Diktat-Modal", () => {
  const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
  const homeVoiceDialog = readFileSync("src/components/mira/MiraVoiceChatDialog.tsx", "utf8");
  const conversationDialog = readFileSync(
    "src/components/mira/MiraVoiceConversationDialog.tsx",
    "utf8",
  );
  assert.equal((page.match(/<MiraSpeechPrivacySettings \/>/g) ?? []).length, 2);
  assert.match(
    page,
    /Je nach Browser kann Audio an dessen Spracherkennungsdienst übertragen werden/,
  );
  assert.match(page, /Mira erhält erkannten Text, keine rohe Mikrofonaufnahme/);
  assert.match(page, /erst nach deinem normalen Tipp\s+auf „Senden“ an Mira übermittelt/);
  assert.doesNotMatch(page, /MiraVoiceChatDialog|Entwurf im Chat ansehen/);
  assert.doesNotMatch(homeVoiceDialog, /Browser-Spracherkennungsdienst|Audio an dessen/);
  assert.doesNotMatch(conversationDialog, /mira-voice-info|Browser-Spracherkennungsdienst/);
});

test("Sprachausgabe startet nur über eine Antwortaktion und lässt sich abbrechen", () => {
  const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
  const actions = readFileSync("src/components/mira/MiraAnswerActions.tsx", "utf8");
  const dictation = readFileSync("src/lib/mira-inline-dictation.ts", "utf8");
  assert.match(page, /onSpeak=\{\(\) => speakMiraMessage\(i, m\.content\)\}/);
  assert.match(actions, /onClick=\{onSpeak\}/);
  assert.match(page, /window\.speechSynthesis\.cancel\(\)/);
  assert.match(dictation, /Spracherkennung wird in diesem Browser nicht unterstützt/);
  assert.match(dictation, /Mikrofonzugriff wurde nicht erlaubt/);
});

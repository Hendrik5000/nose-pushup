import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  isLikelyMiraSpeechEcho,
  MiraVoiceConversationController,
  type MiraSpeechRecognitionLike,
  type MiraSpeechSynthesisLike,
  type MiraSpeechUtteranceLike,
  type MiraVoiceConversationPhase,
} from "../src/lib/mira-voice-conversation";

class FakeRecognition implements MiraSpeechRecognitionLike {
  lang = "";
  continuous = false;
  interimResults = false;
  startCount = 0;
  stopCount = 0;
  abortCount = 0;
  onresult: MiraSpeechRecognitionLike["onresult"] = null;
  onerror: MiraSpeechRecognitionLike["onerror"] = null;
  onend: MiraSpeechRecognitionLike["onend"] = null;

  start() {
    this.startCount += 1;
  }

  stop() {
    this.stopCount += 1;
  }

  abort() {
    this.abortCount += 1;
  }

  emit(transcript: string, isFinal: boolean, resultIndex = 0) {
    this.onresult?.({
      resultIndex,
      results: {
        length: resultIndex + 1,
        [resultIndex]: { isFinal, 0: { transcript } },
      },
    });
  }
}

type Harness = {
  controller: MiraVoiceConversationController;
  recognitions: FakeRecognition[];
  spokenTexts: string[];
  utterances: MiraSpeechUtteranceLike[];
  phases: MiraVoiceConversationPhase[];
  transcripts: string[];
  errors: Array<string | null>;
  sent: string[];
  cancellations: number;
};

function createHarness(responses: string[] = ["Hallo! Ich höre dich."]): Harness {
  const harness = {
    controller: null as unknown as MiraVoiceConversationController,
    recognitions: [] as FakeRecognition[],
    spokenTexts: [] as string[],
    utterances: [] as MiraSpeechUtteranceLike[],
    phases: [] as MiraVoiceConversationPhase[],
    transcripts: [] as string[],
    errors: [] as Array<string | null>,
    sent: [] as string[],
    cancellations: 0,
  };
  const synthesis: MiraSpeechSynthesisLike = {
    getVoices: () => [],
    speak: (utterance) => harness.utterances.push(utterance),
    cancel: () => {
      harness.cancellations += 1;
    },
    resume: () => undefined,
  };
  harness.controller = new MiraVoiceConversationController({
    createRecognition: () => {
      const recognition = new FakeRecognition();
      harness.recognitions.push(recognition);
      return recognition;
    },
    speechSynthesis: synthesis,
    createUtterance: (text) => {
      harness.spokenTexts.push(text);
      return {
        lang: "",
        rate: 1,
        pitch: 1,
        volume: 1,
        voice: null,
        onend: null,
        onerror: null,
      };
    },
    sendTranscript: async (transcript) => {
      harness.sent.push(transcript);
      return responses.shift() ?? "Noch eine Antwort.";
    },
    onPhaseChange: (phase) => harness.phases.push(phase),
    onTranscriptChange: (transcript) => harness.transcripts.push(transcript),
    onErrorChange: (error) => harness.errors.push(error),
  });
  return harness;
}

function delay(milliseconds = 620) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendOneTurn(harness: Harness, transcript: string) {
  const recognition = harness.recognitions.at(-1);
  assert.ok(recognition, "recognition should have started");
  recognition.emit(transcript, true);
  await delay();
}

test("Freisprechen startet nur nach Tipp, sendet erkannten Text und liest die Antwort lokal vor", async () => {
  const harness = createHarness();
  assert.equal(
    harness.recognitions.length,
    0,
    "constructing the flow must not activate the microphone",
  );

  harness.controller.start();
  assert.equal(harness.recognitions.length, 1);
  assert.equal(harness.recognitions[0]?.startCount, 1);
  assert.equal(harness.recognitions[0]?.lang, "de-DE");
  assert.equal(harness.sent.length, 0);
  assert.equal(harness.phases.at(-1), "listening");

  harness.recognitions[0]?.emit("Wie wird das Wetter morgen", false);
  assert.equal(harness.sent.length, 0, "interim text is never sent");
  await sendOneTurn(harness, "Wie wird das Wetter morgen?");

  assert.deepEqual(harness.sent, ["Wie wird das Wetter morgen?"]);
  assert.deepEqual(harness.spokenTexts, ["Hallo! Ich höre dich."]);
  assert.equal(harness.phases.at(-1), "speaking");
  assert.equal(
    harness.recognitions.length,
    2,
    "the session listens for an interruption during speech",
  );
  assert.equal(harness.utterances.length, 1);

  harness.utterances[0]?.onend?.();
  assert.equal(
    harness.phases.at(-1),
    "listening",
    "listening resumes after Mira finishes speaking",
  );
  assert.equal(harness.recognitions[1]?.startCount, 1);
  harness.controller.stop();
});

test("Nutzer kann Mira während der Antwort per Sprache unterbrechen; Mira-Echo wird gefiltert", async () => {
  const harness = createHarness(["Die nächste Antwort.", "Und noch eine Antwort."]);
  harness.controller.start();
  await sendOneTurn(harness, "Erzähl mir etwas");

  const listeningDuringSpeech = harness.recognitions.at(-1);
  assert.ok(listeningDuringSpeech);
  listeningDuringSpeech.emit("Die nächste Antwort", false);
  assert.equal(harness.cancellations, 0, "a phrase matching the spoken answer is treated as echo");
  assert.equal(harness.phases.at(-1), "speaking");

  listeningDuringSpeech.emit("Warte bitte kurz", false);
  assert.equal(harness.cancellations, 0, "interim speech cannot accidentally interrupt Mira");
  listeningDuringSpeech.emit("Warte bitte kurz", true);
  assert.equal(harness.cancellations, 1, "confirmed non-echo speech interrupts Mira");
  assert.equal(harness.phases.at(-1), "listening");
  await delay();
  assert.deepEqual(harness.sent, ["Erzähl mir etwas", "Warte bitte kurz"]);
  assert.deepEqual(harness.spokenTexts, ["Die nächste Antwort.", "Und noch eine Antwort."]);
  assert.equal(harness.phases.at(-1), "speaking");
  harness.controller.stop();
});

test("explizites Stopp-Kommando unterbricht Mira bereits als Zwischenresultat", async () => {
  const harness = createHarness();
  harness.controller.start();
  await sendOneTurn(harness, "Sag etwas");
  const recognition = harness.recognitions.at(-1);
  assert.ok(recognition);
  recognition.emit("stopp", false);
  assert.equal(harness.cancellations, 1);
  assert.equal(harness.phases.at(-1), "listening");
  recognition.emit("stopp", true);
  assert.deepEqual(harness.sent, ["Sag etwas"], "the stop command is not sent as a new Mira turn");
  assert.equal(harness.transcripts.at(-1), "");
  harness.controller.stop();
});

test("Stop und Dispose entwerten verspätete Recognition- und Speech-Ereignisse", async () => {
  const harness = createHarness();
  harness.controller.start();
  const firstRecognition = harness.recognitions[0];
  const lateEnd = firstRecognition?.onend;
  harness.controller.stop();
  assert.equal(firstRecognition?.abortCount, 1);
  assert.equal(harness.phases.at(-1), "idle");
  lateEnd?.();
  await delay(300);
  assert.equal(harness.recognitions.length, 1, "late onend cannot restart the microphone");
  assert.equal(harness.sent.length, 0);

  harness.controller.start();
  await sendOneTurn(harness, "Noch eine Frage");
  const speakingRecognition = harness.recognitions.at(-1);
  const lateSpeechEnd = harness.utterances.at(-1)?.onend;
  harness.controller.dispose();
  assert.ok((speakingRecognition?.abortCount ?? 0) > 0);
  lateSpeechEnd?.();
  await delay(300);
  assert.equal(harness.recognitions.length, 3, "disposed sessions cannot restart listening");
  assert.equal(
    harness.phases.at(-1),
    "speaking",
    "silent disposal does not notify an unmounted view",
  );
});

test("unsupported recognition fails closed without sending anything", () => {
  const phases: MiraVoiceConversationPhase[] = [];
  const errors: Array<string | null> = [];
  const controller = new MiraVoiceConversationController({
    createRecognition: () => null,
    speechSynthesis: { getVoices: () => [], speak: () => undefined, cancel: () => undefined },
    createUtterance: () => ({
      lang: "",
      rate: 1,
      pitch: 1,
      volume: 1,
      voice: null,
      onend: null,
      onerror: null,
    }),
    sendTranscript: async () => {
      assert.fail("unsupported recognition must not send");
      return null;
    },
    onPhaseChange: (phase) => phases.push(phase),
    onErrorChange: (error) => errors.push(error),
  });
  controller.start();
  assert.equal(phases.at(-1), "error");
  assert.match(errors.at(-1) ?? "", /nicht unterstützt/);
  controller.stop();
});

test("Echo-Heuristik erlaubt ausdrückliche kurze Unterbrechungen", () => {
  assert.equal(isLikelyMiraSpeechEcho("Mira hilft dir dabei", "Mira hilft dir dabei."), true);
  assert.equal(isLikelyMiraSpeechEcho("stopp", "Mira sagt jetzt stopp nicht"), false);
  assert.equal(isLikelyMiraSpeechEcho("eine neue Frage", "Mira hilft dir dabei"), false);
});

test("Integration behält bearbeitbares Diktat und sendet Sprachturns text-only über submit", () => {
  const conversationDialog = readFileSync(
    "src/components/mira/MiraVoiceConversationDialog.tsx",
    "utf8",
  );
  const voiceStyles = readFileSync("src/mira-voice.css", "utf8");
  const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
  const settingsControls = readFileSync("src/components/mira/MiraAppSettingsControls.tsx", "utf8");
  const speechSettings = readFileSync("src/components/mira/MiraSpeechPrivacySettings.tsx", "utf8");

  assert.match(conversationDialog, /mira-voice-dialog fixed inset-0/);
  assert.match(conversationDialog, /mira-voice-orb/);
  assert.doesNotMatch(conversationDialog, /ChatGPT/);
  assert.match(conversationDialog, /onClick=\{micAction\}/);
  assert.match(conversationDialog, /phase === "speaking" \? onInterruptSpeech/);
  assert.match(voiceStyles, /prefers-reduced-motion/);
  assert.match(page, /includeAttachments: false/);
  assert.match(page, /preserveComposer: true/);
  assert.match(page, /submitRef\.current\(transcript, messagesRef\.current/);
  assert.match(page, /<MiraVoiceConversationDialog/);
  assert.equal((page.match(/<MiraAppSettingsControls\b/g) ?? []).length, 2);
  assert.match(settingsControls, /<MiraSpeechPrivacySettings \/>/);
  assert.match(speechSettings, /Mira erhält erkannten Text, keine rohe Mikrofonaufnahme/);
  assert.doesNotMatch(conversationDialog, /mira-voice-info|Browser-Spracherkennungsdienst/);
  assert.match(conversationDialog, /onClick=\{\(\) => onOpenChange\(false\)\}/);
  assert.match(conversationDialog, /Sprachgespräch beenden und Mikrofon ausschalten/);
});

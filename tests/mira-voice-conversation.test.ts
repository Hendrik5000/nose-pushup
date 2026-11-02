import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
const dialog = readFileSync("src/components/mira/MiraVoiceConversationDialog.tsx", "utf8");
const styles = readFileSync("src/mira-voice.css", "utf8");

const openHandlerStart = page.indexOf(
  "const handleVoiceConversationOpenChange = (open: boolean) => {",
);
const recognitionStart = page.indexOf("const startVoiceRecognition = (", openHandlerStart);
const openHandler = page.slice(openHandlerStart, recognitionStart);
const recognitionEnd = page.indexOf("const toggleVoice =", recognitionStart);
const recognitionHandler = page.slice(recognitionStart, recognitionEnd);
const stopHandlerStart = page.indexOf("const stopVoiceConversation = useCallback(() => {");
const stopHandlerEnd = page.indexOf("const resetVoiceConversation =", stopHandlerStart);
const stopHandler = page.slice(stopHandlerStart, stopHandlerEnd);

test("Sprachgespräch bleibt im selben Mira-Chat und lässt Text und Anbieteranzeige verfügbar", () => {
  assert.match(dialog, /DialogTitle className="sr-only">Sprachgespräch mit Mira/);
  assert.match(dialog, /<MiraSpark \/>/);
  assert.match(dialog, /role="img"/);
  assert.match(dialog, /Nachricht an Mira schreiben/);
  assert.match(dialog, /Zum Textchat zurückkehren/);
  assert.match(dialog, /latestAssistant\.content/);
  assert.match(page, /onClick=\{\(\) => handleVoiceConversationOpenChange\(true\)\}/);
  assert.match(page, /messages=\{messages\}/);
  assert.match(dialog, /Anbieter: \{provider\}/);
  assert.match(dialog, /Daten & Routing/);
});

test("Öffnen startet kein Mikrofon; die Sitzung startet ausdrücklich und erklärt Browser-Audio vorher", () => {
  assert.match(openHandler, /voiceConversationOpenRef\.current = true/);
  assert.match(openHandler, /setVoiceConversationActive\(false\)/);
  assert.doesNotMatch(openHandler, /recognition\.start\(\)|startVoiceRecognition\(/);
  assert.match(dialog, /onClick=\{sessionActive \? onStopConversation : onStartConversation\}/);
  assert.match(dialog, /sessionActive \? "Gespräch unterbrechen und stoppen" : "Gespräch starten"/);
  assert.match(dialog, /disabled=\{!sessionActive && \(!canStart \|\| loading\)\}/);
  assert.match(
    dialog,
    /Je nach Browser kann\s+die\s+Spracherkennung Audio zur Verarbeitung an einen Browserdienst senden/,
  );
  assert.match(dialog, /nicht\s+immer lokal/);
  assert.match(dialog, /Mira erhält den erkannten Text, nicht die rohe Aufnahme/);
  assert.match(page, /sessionActive=\{voiceConversationActive\}/);
  assert.match(page, /onStartConversation=\{startVoiceConversation\}/);
  assert.match(
    page,
    /voiceConversationOpenRef\.current \|\| voiceConversationActiveRef\.current\) return/,
  );
});

test("iPhone-Safari-TTS wird im Start-Tipp aktiviert und still verworfene Sprache gemeldet", () => {
  const startHandlerStart = page.indexOf("const startVoiceConversation = () => {");
  const startHandlerEnd = page.indexOf("const stopMiraSpeechAndResume =", startHandlerStart);
  const startHandler = page.slice(startHandlerStart, startHandlerEnd);
  const speechStart = page.indexOf("const speakMiraResponse =");
  const speechEnd = page.indexOf("const regenerate =", speechStart);
  const automaticSpeech = page.slice(speechStart, speechEnd);

  assert.match(startHandler, /primeMiraSpeechForUserGesture/);
  assert.ok(
    startHandler.indexOf("primeMiraSpeechForUserGesture") <
      startHandler.indexOf('startVoiceRecognition("conversation"'),
  );
  assert.doesNotMatch(startHandler, /await\s/);
  assert.match(
    automaticSpeech,
    /window\.speechSynthesis\.resume\(\);\s*window\.speechSynthesis\.speak\(utterance\)/,
  );
  assert.match(
    automaticSpeech,
    /typeof window\.speechSynthesis\.resume === "function"\) window\.speechSynthesis\.resume\(\)/,
  );
  assert.match(
    startHandler,
    /resume: \(\) => \{\s*if \(typeof window\.speechSynthesis\.resume === "function"\)/,
  );
  assert.match(automaticSpeech, /speechStartTimeoutRef\.current = window\.setTimeout/);
  assert.match(automaticSpeech, /Der Browser hat Miras Sprachausgabe nicht gestartet/);
  assert.match(page, /const clearSpeechStartTimeout = useCallback/);
  assert.match(page, /clearSpeechStartTimeout\(\);\s*speechUtteranceRef\.current = null/);
});

test("Aufeinanderfolgende Sprachbeiträge gehen ohne Senden-Tipp an denselben Mira-Anbieter", () => {
  assert.match(recognitionHandler, /recognition\.continuous = false/);
  assert.match(recognitionHandler, /recognition\.lang = "de-DE"/);
  assert.match(
    recognitionHandler,
    /void submit\(transcript, messages, \{\s*includeAttachments: false,\s*clearDraft: false,\s*autoSpeak: true,\s*voiceTurn: true,/,
  );
  assert.match(
    page,
    /const scheduleVoiceRecognition = \(conversationSession: number, listenDuringSpeech = false\) =>/,
  );
  assert.match(page, /startVoiceRecognition\("conversation", conversationSession\)/);
  assert.match(page, /utterance\.onend = \(\) => \{[\s\S]*?scheduleVoiceRecognition\(session\)/);
  assert.match(
    page,
    /const outgoingAttachments = options\.includeAttachments === false \? \[\] : attachments/,
  );
  assert.match(
    dialog,
    /Vorhandene Anhänge bleiben im Textchat und werden mit Sprachbeiträgen nicht gesendet/,
  );
});

test("Mira bleibt während ihrer Sprachausgabe unterbrechbar und ihr akustisches Echo wird gefiltert", () => {
  assert.match(
    page,
    /if \(voiceRestartTimerRef\.current !== null\)[\s\S]*?if \(recognitionRef\.current\) \{[\s\S]*?activeRecognition\.stop\(\)/,
  );
  assert.match(page, /window\.speechSynthesis\.speak\(utterance\)/);
  assert.match(page, /startVoiceRecognition\("conversation", session, true\)/);
  assert.match(page, /recognition\.interimResults = mode === "conversation" && listenDuringSpeech/);
  assert.match(page, /isLikelyMiraSpeechEcho\(observedTranscript, speechTextRef\.current\)/);
  assert.match(
    page,
    /if \(finalTranscript \|\| isMiraVoiceInterruption\(observedTranscript\)\) stopMiraSpeech\(\)/,
  );
  assert.match(page, /scheduleVoiceRecognition\(conversationSession, true\)/);
  assert.match(
    page,
    /voiceConversationActiveRef\.current &&[\s\S]*?if \(!recognitionRef\.current\) scheduleVoiceRecognition\(session\)/,
  );
  assert.match(recognitionHandler, /recognitionRef\.current !== recognition/);
  assert.match(recognitionHandler, /conversationSession !== voiceConversationSessionRef\.current/);
  assert.match(dialog, /sprich einfach hinein, um sie zu unterbrechen/);
  assert.match(dialog, /Miras gerade gelesene[\s\S]*?als Echo ausgefiltert/);
});

test("Stopp bleibt während Denken und Sprechen verfügbar und beendet Erkennung, TTS sowie Antwortannahme", () => {
  assert.match(dialog, /Unterbrechen \/ Gespräch beenden/);
  assert.match(dialog, /disabled=\{!sessionActive && \(!canStart \|\| loading\)\}/);
  assert.match(stopHandler, /voiceConversationActiveRef\.current = false/);
  assert.match(stopHandler, /voiceConversationSessionRef\.current \+= 1/);
  assert.match(stopHandler, /recognitionTokenRef\.current \+= 1/);
  assert.match(stopHandler, /generationRef\.current \+= 1/);
  assert.match(stopHandler, /stopMiraSpeech\(\)/);
  assert.match(
    openHandler,
    /stopVoiceConversation\(\);\s*voiceConversationOpenRef\.current = false/,
  );
  assert.match(
    page,
    /voiceConversationActiveRef\.current = false;[\s\S]*?window\.speechSynthesis\.cancel\(\)/,
  );
});

test("Schließen verwirft getippte Voice-Dialog-Anfragen, ohne unabhängige Textchat-Anfragen zu stoppen", () => {
  assert.match(page, /voiceDialogRequestGenerationRef = useRef<number \| null>\(null\)/);
  assert.match(page, /options\.voiceDialogRequest && voiceConversationOpenRef\.current/);
  assert.match(page, /voiceDialogRequest: true/);
  assert.match(stopHandler, /sendingRef\.current && \(wasActive \|\| cancelVoiceDialogRequest\)/);
  assert.match(stopHandler, /voiceDialogRequestGenerationRef\.current === generationRef\.current/);
  assert.match(
    openHandler,
    /stopVoiceConversation\(\);\s*voiceConversationOpenRef\.current = false/,
  );
  assert.match(dialog, /Beim Stoppen oder Schließen wird das Mikrofon ausgeschaltet/);
});

test("Nicht unterstützte APIs und Erkennungs-/TTS-Fehler stoppen sicher und lassen Textchat verfügbar", () => {
  assert.match(page, /Dieser Browser unterstützt keine Spracherkennung/);
  assert.match(page, /Dieser Browser unterstützt keine Gerätestimme/);
  assert.match(page, /event\?\.error === "not-allowed"/);
  assert.match(recognitionHandler, /stopVoiceConversation\(\);\s*setVoiceError\(message\)/);
  assert.match(page, /utterance\.onerror = \(\) => \{[\s\S]*?stopVoiceConversation\(\)/);
  assert.match(page, /Nutze stattdessen den Textchat/);
  assert.match(dialog, /supportMessage &&/);
  assert.match(dialog, /Nachricht an Mira senden/);
});

test("Aussagekräftige Zwischenresultate gehen bei Abbruch der Browsererkennung nicht verloren", () => {
  assert.match(recognitionHandler, /const interimTranscript = recognizedResults/);
  assert.match(recognitionHandler, /isMiraVoiceInterruption\(observedTranscript\)/);
  assert.match(recognitionHandler, /voiceInterimTranscriptRef\.current = interimTranscript/);
  assert.match(
    recognitionHandler,
    /resolveMiraVoiceTurnTranscript\(\s*finalizedTranscript,\s*voiceInterimTranscriptRef\.current/,
  );
  assert.match(
    recognitionHandler,
    /if \(usedInterimTranscript\) \{\s*voiceTranscriptRef\.current = transcript;\s*setVoiceTranscript\(transcript\);/,
  );
});

test("Mira-Orb berücksichtigt Smartphone-Sicherheitsabstände und reduzierte Bewegung", () => {
  assert.match(styles, /\.mira-voice-orb/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /env\(safe-area-inset-left\)/);
  assert.match(styles, /env\(safe-area-inset-right\)/);
  assert.match(dialog, /env\(safe-area-inset-top\)/);
  assert.match(dialog, /env\(safe-area-inset-bottom\)/);
});

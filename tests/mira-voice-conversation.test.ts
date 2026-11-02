import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/components/mira/SuperAiPage.tsx", "utf8");
const dialog = readFileSync("src/components/mira/MiraVoiceConversationDialog.tsx", "utf8");
const styles = readFileSync("src/mira-voice.css", "utf8");

test("Mira-Sprachgespräch nutzt Miras Marke, bleibt mehrteilig und hält Textchat verfügbar", () => {
  assert.match(dialog, /DialogTitle className="sr-only">Sprachgespräch mit Mira/);
  assert.match(dialog, /<MiraSpark \/>/);
  assert.match(dialog, /role="img"/);
  assert.match(dialog, /Nachricht an Mira schreiben/);
  assert.match(dialog, /Zum Textchat zurückkehren/);
  assert.match(dialog, /latestAssistant\.content/);
  assert.match(page, /onClick=\{\(\) => handleVoiceConversationOpenChange\(true\)\}/);
  assert.match(page, /messages=\{messages\}/);
});

test("Sprachaufnahme startet nur per Tipp; Anbieter, Routing, Browser-Audio und Kontext werden offengelegt", () => {
  assert.match(dialog, /onClick=\{listening \? onStopListening : onStartListening\}/);
  assert.match(dialog, /Das Mikrofon startet erst nach deinem Tipp/);
  assert.match(dialog, /Anbieter: \{provider\}/);
  assert.match(dialog, /Daten & Routing/);
  assert.match(dialog, /Spracherkennung läuft über den Browser/);
  assert.match(dialog, /\{routing\}/);
  assert.match(dialog, /\{contextNotice\}/);
  assert.match(dialog, /automatisch an den angezeigten Anbieter\s+gesendet/);
  assert.match(page, /onStartListening=\{\(\) => toggleVoice\("conversation"\)\}/);
  assert.match(page, /onStopListening=\{\(\) => toggleVoice\("conversation"\)\}/);
});

test("Sprachbeiträge senden nur erkannten Text, bewahren den Chat-Entwurf und lassen Anhänge im Textchat", () => {
  const start = page.indexOf('const toggleVoice = (mode: "dictation" | "conversation"');
  const end = page.indexOf("const speakMiraMessage", start);
  const recognitionHandler = page.slice(start, end);

  assert.match(
    recognitionHandler,
    /void submit\(transcript, messages, \{\s*includeAttachments: false,\s*clearDraft: false,\s*autoSpeak: true,\s*voiceTurn: true,/,
  );
  assert.match(
    page,
    /const outgoingAttachments = options\.includeAttachments === false \? \[\] : attachments/,
  );
  assert.match(page, /if \(options\.clearDraft !== false\) setInput\(""\)/);
  assert.match(dialog, /Vorhandene Anhänge bleiben im Textchat/);
  assert.match(dialog, /onRetryTranscript/);
  assert.match(dialog, /Erkannten Beitrag senden/);
  assert.match(page, /includeAttachments: false, autoSpeak: true/);
});

test("Verspätete Mikrofon-Callbacks überschreiten keine Sitzung und blockieren den nächsten Chat nicht", () => {
  assert.match(page, /const recognitionTokenRef = useRef\(0\)/);
  assert.match(page, /recognitionTokenRef\.current !== recognitionToken/);
  assert.match(page, /conversationSession !== voiceConversationSessionRef\.current/);
  assert.match(page, /recognitionRef\.current !== rec/);
  assert.match(page, /sendingRef\.current = false/);
  assert.match(page, /generationRef\.current \+= 1;\s*sendingRef\.current = false;/);
});

test("Mira-Orb berücksichtigt Smartphone-Sicherheitsabstände und reduzierte Bewegung", () => {
  assert.match(styles, /\.mira-voice-orb/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /env\(safe-area-inset-left\)/);
  assert.match(styles, /env\(safe-area-inset-right\)/);
  assert.match(dialog, /env\(safe-area-inset-top\)/);
  assert.match(dialog, /env\(safe-area-inset-bottom\)/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/routes/_authenticated/index.tsx");
const styles = read("src/mira-home-overlay.css");
const voiceDialog = read("src/components/mira/MiraVoiceChatDialog.tsx");
const handoff = read("src/components/alo/MiraHandoff.tsx");
const superAi = read("src/components/mira/SuperAiPage.tsx");
const launcherStart = home.indexOf("function MiraOverlayLauncher");
const launcherEnd = home.indexOf("\nfunction Dashboard", launcherStart);
const launcher = home.slice(launcherStart, launcherEnd);

test("Home restores the historical bottom-center Mira launcher and voice dialog", () => {
  assert.notEqual(launcherStart, -1, "the historical launcher component should exist");
  assert.match(home, /<HomeAppHub[\s\S]*?<MiraOverlayLauncher \/>/);
  assert.match(launcher, /aria-label="Mira öffnen oder halten, um eine Frage zu diktieren"/);
  assert.match(launcher, /<MiraSpark \/>/);
  assert.match(launcher, /<MiraVoiceChatDialog/);
  assert.match(launcher, /createBrowserSpeechRecognitionFactory/);
  assert.match(launcher, /new MiraComposerPressAndHold/);
  assert.match(launcher, /pointerDown/);
  assert.match(launcher, /pointerUp/);
  assert.match(launcher, /pointerCancel/);
  assert.match(launcher, /canceledPointerIdRef/);
  assert.match(launcher, /if \(wasCanceled\) suppressNextClick\(\)/);
  assert.match(launcher, /MiraInlineDictationController/);
  assert.match(launcher, /interimTranscript/);
  assert.match(
    launcher,
    /\(listening \|\| interimTranscript\)[\s\S]*alo-mira-home-live-transcript[\s\S]*\{transcript\}[\s\S]*\{interimTranscript\}/,
  );
  assert.match(launcher, /aria-describedby="home-mira-hold-disclosure"/);
  assert.match(launcher, /holdTriggeredRef/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /bottom:\s*calc\(env\(safe-area-inset-bottom/);
  assert.match(styles, /left:\s*50%/);
  assert.match(styles, /transform:\s*translateX\(-50%\)/);
  assert.match(styles, /data-navigation-expanded="true"/);
  assert.match(styles, /data-navigation-layout="bottom"/);
  assert.match(styles, /data-navigation-layout="floating"/);
  assert.match(styles, /bottom:\s*calc\(5rem \+ env\(safe-area-inset-bottom, 0px\) \+ 0\.75rem\)/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(
    styles,
    /\.alo-mira-home-live-transcript\s*\{[\s\S]*position:\s*absolute;[\s\S]*bottom:\s*calc\(100% \+ 0\.75rem\)/,
  );
});

test("Home voice handoff sends the recognized question directly to Mira after dictation ends", () => {
  assert.match(launcher, /autoHandoffRef/);
  assert.match(launcher, /onSettled/);
  assert.match(launcher, /handoffToMira\(\{/);
  assert.match(launcher, /alo-mira-autosend/);
  assert.match(launcher, /navigate\(\{ to: "\/ai" \}\)/);
  assert.match(launcher, /label="Frage in Mira prüfen"/);
  assert.match(launcher, /aria-label="Diktierte Frage verwerfen"/);
  assert.doesNotMatch(launcher, /openOnMount/);
  assert.doesNotMatch(launcher, /superAiChat|fetch\(|submit\(/);
  assert.match(voiceDialog, /onContinue\?: \(\) => void/);
  assert.match(
    voiceDialog,
    /onClick=\{\(\) => \(onContinue \? onContinue\(\) : onOpenChange\(false\)\)\}/,
  );
  assert.match(voiceDialog, /Je nach Browser\s+kann/);
  assert.match(voiceDialog, /direkt an Mira übergeben/);
  assert.doesNotMatch(voiceDialog, /nichts\s+wird\s+automatisch\s+an Mira gesendet/);
  assert.doesNotMatch(voiceDialog, /Mira wird nicht automatisch kontaktiert/);
  assert.match(handoff, /Kein Versand beim Öffnen/);
  assert.match(handoff, /Kein automatisches Senden/);
  assert.match(superAi, /alo-mira-autosend/);
  assert.match(superAi, /submitRef\.current\(text, messagesRef\.current/);
});

test("Home voice mode opens centered and fullscreen like the Mira voice conversation", () => {
  assert.match(
    launcher,
    /alo-mira-voice-entry-dialog !fixed !left-0 !top-0 !z-50 !m-0 !flex !h-\[100dvh\] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none/,
  );
  assert.match(
    voiceDialog,
    /mx-auto flex min-h-\[100dvh\] w-full max-w-2xl flex-col justify-center gap-5 px-5/,
  );
  assert.match(styles, /\.alo-mira-voice-entry-dialog\s*\{[^}]*border-radius:\s*0 !important/);
  assert.match(styles, /\.alo-mira-voice-entry-dialog\s*\{[^}]*box-shadow:\s*none !important/);
});

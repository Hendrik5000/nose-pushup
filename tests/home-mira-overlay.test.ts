import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/routes/_authenticated/index.tsx");
const styles = read("src/mira-home-overlay.css");
const voiceDialog = read("src/components/mira/MiraVoiceChatDialog.tsx");
const handoff = read("src/components/alo/MiraHandoff.tsx");
const launcherStart = home.indexOf("function MiraOverlayLauncher");
const launcherEnd = home.indexOf("\nfunction Dashboard", launcherStart);
const launcher = home.slice(launcherStart, launcherEnd);

test("Home restores the historical bottom-center Mira launcher and voice dialog", () => {
  assert.notEqual(launcherStart, -1, "the historical launcher component should exist");
  assert.match(home, /<HomeAppHub[\s\S]*?<MiraOverlayLauncher \/>/);
  assert.match(launcher, /aria-label="Mira öffnen und eine Frage stellen"/);
  assert.match(launcher, /<MiraSpark \/>/);
  assert.match(launcher, /<MiraVoiceChatDialog/);
  assert.match(launcher, /createBrowserSpeechRecognitionFactory/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /bottom:\s*calc\(env\(safe-area-inset-bottom/);
  assert.match(styles, /left:\s*50%/);
  assert.match(styles, /transform:\s*translateX\(-50%\)/);
  assert.match(styles, /data-navigation-expanded="true"/);
  assert.match(styles, /data-navigation-layout="bottom"/);
  assert.match(styles, /data-navigation-layout="floating"/);
  assert.match(styles, /bottom:\s*calc\(5rem \+ env\(safe-area-inset-bottom, 0px\) \+ 0\.75rem\)/);
});

test("Home voice handoff keeps the current explicit preview and never sends to Mira automatically", () => {
  assert.match(launcher, /label="Frage in Mira prüfen"/);
  assert.match(launcher, /aria-label="Diktierte Frage verwerfen"/);
  assert.doesNotMatch(launcher, /openOnMount/);
  assert.doesNotMatch(launcher, /superAiChat|fetch\(|submit\(/);
  assert.match(voiceDialog, /onContinue\?: \(\) => void/);
  assert.match(
    voiceDialog,
    /onClick=\{\(\) => \(onContinue \? onContinue\(\) : onOpenChange\(false\)\)\}/,
  );
  assert.match(voiceDialog, /Mira wird nicht automatisch kontaktiert/);
  assert.match(handoff, /Kein Versand beim Öffnen/);
  assert.match(handoff, /Kein automatisches Senden/);
});

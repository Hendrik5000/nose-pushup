import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("components/mira/SuperAiPage.tsx");
const css = read("mira-pr52-design.css");
const sport = page.slice(page.indexOf('<DesignView variant="sport">'));

test("PR52 reference is an explicit Mira-route visual opt-in, not a global app rollback", () => {
  assert.match(read("routes/_authenticated/ai.tsx"), /<SuperAiPage sketchLayout \/>/);
  assert.match(read("routes/_authenticated/coach.tsx"), /<SuperAiPage \/>/);
  assert.match(page, /sketchLayout = false/);
  assert.ok(
    page.indexOf('import "@/mira-pr52-design.css"') >
      page.indexOf('import "@/mira-chat-design.css"'),
  );
  assert.match(css, /html:root\[data-design-style\] \.alo-mira-sketch-page/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});

test("reference header restores sidebar, topic, provider, profile and accessible privacy/settings toggle", () => {
  const header = sport.slice(
    sport.indexOf('<header className="alo-mira-sketch-header">'),
    sport.indexOf("</header>"),
  );
  for (const expected of [
    "<AloPageSidebarTrigger",
    "{activeTitle}",
    "activeProvider?.label",
    'to="/profile"',
    'aria-controls="mira-chat-options"',
    "aria-expanded={chatOptionsOpen}",
  ])
    assert.ok(header.includes(expected), expected);
  assert.match(header, /onClick=\{\(\) => setChatOptionsOpen\(\(value\) => !value\)\}/);
  assert.match(
    sport,
    /id="mira-chat-options"[\s\S]*?open=\{chatOptionsOpen\}[\s\S]*?onToggle=\{\(event\) => setChatOptionsOpen\(event.currentTarget.open\)\}/,
  );
  const options = sport.slice(
    sport.indexOf('id="mira-chat-options"'),
    sport.indexOf('className="sport-chat-stage'),
  );
  assert.match(
    options,
    /sketchLayout && \([\s\S]*?Ideen & Vorlagen[\s\S]*?<MiraStarterSuggestions setInput=\{setInput\}/,
  );
  for (const label of [
    "Gesprächsoptionen & Datenschutz",
    "<MiraContextControls",
    "<AloHomeLink",
    "Ansichten & Werkzeuge",
  ])
    assert.ok(options.includes(label), label);
});

test("reference empty stage is the simple spark greeting while stored replies and rich answers remain", () => {
  const stage = sport.slice(
    sport.indexOf('className="sport-chat-stage'),
    sport.indexOf('className="mira-chat-bottom-row"'),
  );
  const referenceGreeting = stage.slice(
    stage.indexOf("{sketchLayout ? ("),
    stage.indexOf(") : (", stage.indexOf("{sketchLayout ? (")),
  );
  assert.match(referenceGreeting, /wobei kann ich helfen\?/);
  assert.doesNotMatch(
    referenceGreeting,
    /MiraStarterSuggestions|mira-chat-welcome-label|mira-chat-welcome-copy/,
  );
  assert.match(stage, /mira-chat-welcome-mark[\s\S]*?<MiraSpark/);
  for (const component of ["MiraProgressiveAnswer", "MiraInteractiveCard", "MiraVisualAnswerCard"])
    assert.ok(stage.includes(`<${component}`), component);
  assert.match(stage, /\{messages.map\(\(m, i\) => \(/);
});

test("capsule keeps attachment, text, hands-free, dictation and explicit submit in screenshot order", () => {
  const composer = sport.slice(
    sport.indexOf("className={`sport-chat-composer"),
    sport.indexOf("</form>", sport.indexOf("className={`sport-chat-composer")),
  );
  assert.match(composer, /sketchLayout \? "alo-mira-capsule-composer"/);
  const labels = [
    "<MiraAttachmentPicker",
    "<textarea",
    "<Headphones",
    'aria-label="Spracheingabe"',
    'aria-label="Nachricht senden"',
  ];
  const positions = labels.map((label) => composer.indexOf(label));
  assert.ok(positions.every((position, i) => position >= 0 && (!i || position > positions[i - 1])));
  assert.match(composer, /handleVoiceConversationOpenChange\(true\)/);
  assert.match(composer, /startInlineDictation/);
  assert.doesNotMatch(composer, /handleVoiceChatOpenChange|MiraVoiceChatDialog/);
  assert.match(composer, /disabled=\{loading \|\| \(!input.trim\(\) && !attachments.length\)\}/);
  assert.match(composer, /compact=\{sketchLayout\}/);
  assert.match(sport, /\{!sketchLayout && userId && <MiraSources userId=\{userId\} \/>\}/);
  assert.doesNotMatch(sport, /Anhänge bleiben lokal, bis du sendest · Dateilimits/);
  assert.match(page, /sendTranscript: \(transcript\) =>[\s\S]*?submitRef.current\(transcript/);
});

test("compact attachment picker has one centered paperclip, no plus, and retains file-picker semantics", () => {
  const attachmentPicker = read("components/mira/MiraAttachments.tsx");
  const trigger = attachmentPicker.slice(
    attachmentPicker.indexOf("<summary"),
    attachmentPicker.indexOf("</summary>") + "</summary>".length,
  );
  const optionsStart = sport.indexOf('id="mira-chat-options"');
  const stageStart = sport.indexOf('className="sport-chat-stage', optionsStart);
  const options = sport.slice(optionsStart, stageStart);
  assert.match(trigger, /aria-label="Foto oder Datei hinzufügen"/);
  assert.equal((trigger.match(/<Paperclip\b/g) ?? []).length, 1);
  assert.match(trigger, /className="alo-mira-attachment-icon"/);
  assert.doesNotMatch(trigger, /<Plus\b|alo-mira-attachment-icons/);
  assert.doesNotMatch(attachmentPicker, /<Plus\b|alo-mira-attachment-icons/);
  assert.match(attachmentPicker, /aria-label="Dateien vom Gerät auswählen"/);
  assert.match(attachmentPicker, /onClick=\{\(\) => files\.current\?\.click\(\)\}/);
  assert.match(
    attachmentPicker,
    /if \(event\.key === "Escape"\)[\s\S]*?querySelector\("summary"\)\?\.focus\(\)/,
  );
  assert.match(attachmentPicker, /export function MiraAttachmentPolicy\(\)/);
  assert.match(attachmentPicker, /Anhänge bleiben lokal, bis du sendest · Dateilimits/);
  assert.match(options, /<MiraContextControls/);
  assert.match(options, /<MiraAttachmentPolicy \/>/);
  assert.match(
    read("mira-pr52-design.css"),
    /\.mira-attachment-picker\s*>\s*summary,[\s\S]*?display: grid;[\s\S]*?place-items: center;[\s\S]*?border-radius: 50%;/,
  );
  assert.doesNotMatch(read("mira-pr52-design.css"), /alo-mira-attachment-icons/);
  assert.match(
    read("mira-pr52-design.css"),
    /\.mira-attachment-picker\s*>\s*summary::marker[\s\S]*?content: ""/,
  );
  assert.match(
    read("mira-pr52-design.css"),
    /\.mira-attachment-picker[\s\S]*?> summary::before,[\s\S]*?> summary::after[\s\S]*?content: none !important;[\s\S]*?display: none !important;/,
  );
  assert.match(
    read("mira-pr52-design.css"),
    /> \.alo-mira-attachment-icon\s*\{[\s\S]*?display: block;[\s\S]*?width: 1\.25rem;[\s\S]*?height: 1\.25rem;/,
  );
});

test("responsive sketch layout removes the empty frame but lets real chat history use and scroll the space", () => {
  const css = read("mira-pr52-design.css");
  const stageStart = css.indexOf(".sport-chat-stage {");
  const stageEnd = css.indexOf("\n}", stageStart);
  const stageRule = css.slice(stageStart, stageEnd);
  assert.ok(stageStart >= 0);
  for (const contract of [
    /min-width: 0;/,
    /flex: 1 1 0;/,
    /overflow-y: auto;/,
    /padding: 0\.5rem clamp\(0\.25rem, 2vw, 0\.75rem\);/,
    /border: 0 !important;/,
    /border-radius: 0 !important;/,
    /background: transparent !important;/,
    /box-shadow: none !important;/,
  ])
    assert.match(stageRule, contract);

  const shortViewportRule = css.indexOf("@media (max-height: 500px)");
  const emptyStageStart = css.indexOf(".sport-chat-stage:has(.mira-chat-welcome)");
  const emptyStageEnd = css.indexOf("\n}", emptyStageStart);
  const emptyStageRule = css.slice(emptyStageStart, emptyStageEnd);
  assert.ok(shortViewportRule >= 0 && emptyStageStart >= 0);
  assert.match(css.slice(shortViewportRule), /sport-chat-stage:not\(:has\(\.mira-chat-welcome\)\)/);
  assert.match(emptyStageRule, /min-height: 0 !important;/);
  assert.match(emptyStageRule, /max-height: none !important;/);
  assert.match(emptyStageRule, /flex: 1 1 0 !important;/);
  assert.match(emptyStageRule, /justify-content: center;/);
  assert.match(emptyStageRule, /overflow: visible;/);
  assert.match(
    css,
    /\.sport-chat-stage:has\(\.mira-chat-welcome\)\s+\.mira-chat-welcome\s*\{[\s\S]*?margin: 0 auto !important;/,
  );

  const classicEmptyStageStart = css.indexOf(".alo-classic-mira-messages:has(.mira-chat-welcome)");
  const classicEmptyStageEnd = css.indexOf("\n}", classicEmptyStageStart);
  const classicEmptyStageRule = css.slice(classicEmptyStageStart, classicEmptyStageEnd);
  assert.ok(classicEmptyStageStart >= 0);
  assert.match(classicEmptyStageRule, /justify-content: center;/);
  const classicWelcomeStart = css.indexOf(
    ".alo-classic-mira-messages:has(.mira-chat-welcome)\n  .mira-chat-welcome",
  );
  const classicWelcomeEnd = css.indexOf("\n}", classicWelcomeStart);
  const classicWelcomeRule = css.slice(classicWelcomeStart, classicWelcomeEnd);
  assert.ok(classicWelcomeStart >= 0);
  assert.match(classicWelcomeRule, /margin: 0 auto !important;/);

  const narrowViewportStart = css.indexOf("@media (max-width: 360px)");
  const reducedMotionStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
  const narrowViewport = css.slice(narrowViewportStart, reducedMotionStart);
  assert.match(narrowViewport, /padding-inline: 0\.55rem !important;/);
  assert.match(narrowViewport, /min-width: 3rem !important;/);
  const stageMarkup = sport.slice(
    sport.indexOf('className="sport-chat-stage'),
    sport.indexOf('className="mira-chat-bottom-row'),
  );
  assert.match(stageMarkup, /messages\.length === 0[\s\S]*?mira-chat-welcome/);
  assert.match(stageMarkup, /messages\.map\(/);
});

test("reference CSS defeats legacy grid/transparent-stage rules while retaining scrolling, touch and theme tokens", () => {
  for (const contract of [
    /height: var\(--app-viewport-height, 100dvh\)/,
    /env\(safe-area-inset-bottom/,
    /\.alo-mira-capsule-composer[\s\S]*?display: flex !important;[\s\S]*?flex-direction: row !important;/,
    /min-width: 3rem !important/,
    /font-size: 16px !important/,
    /min-width: 44px/,
    /min-height: 44px/,
    /:focus-visible/,
    /@media \(max-width: 360px\)/,
    /@media \(prefers-reduced-motion: reduce\)/,
    /color-mix\(in srgb, var\(--card\)/,
  ])
    assert.match(css, contract);
  assert.doesNotMatch(css, /(?:mira-file-help|mira-sources)[^{]*\{[^}]*display:\s*none/s);
});

test("compact classic keeps the repository feature in reachable options and sport retains natural message order", () => {
  const classic = page.slice(
    page.indexOf('<DesignView variant="classic">'),
    page.indexOf('<DesignView variant="sport">'),
  );
  assert.match(classic, /\{!sketchLayout && <MiraGithubRepository \/>\}/);
  const options = classic.slice(
    classic.indexOf('id="mira-classic-options"'),
    classic.indexOf("</details>", classic.indexOf('id="mira-classic-options"')),
  );
  assert.match(options, /\{sketchLayout && <MiraGithubRepository \/>\}/);
  assert.match(options, /<MiraAttachmentPolicy \/>/);
  const stageRule = css.slice(
    css.indexOf(".sport-chat-stage {"),
    css.indexOf("}", css.indexOf(".sport-chat-stage {")),
  );
  assert.match(stageRule, /order: 0;/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Children, createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LayoutGrid, MessageCircle } from "lucide-react";
import { ContentActionButton } from "../src/components/alo/ContentActionButton.tsx";
import { MiraAnswerActions } from "../src/components/mira/MiraAnswerActions.tsx";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("components/mira/SuperAiPage.tsx");
const meta = {
  provider: "lovable",
  task: "general",
  model: "test-model-identifier",
  routingReason: "test-routing-reason",
};
const noop = () => {};
const callbacks = { onSpeak: noop, onCopy: noop, onBookmark: noop };

function linkedActions() {
  return [
    createElement(ContentActionButton, {
      key: "chat",
      iconOnly: true,
      icon: MessageCircle,
      label: "Mit Mira besprechen",
      onClick: noop,
    }),
    createElement(ContentActionButton, {
      key: "alo",
      iconOnly: true,
      icon: LayoutGrid,
      label: "Alo-Aktionen",
      onClick: noop,
    }),
  ];
}

test("reply diagnostics are only inside initially closed icon details, never inline", () => {
  const answer = "Miras vollständige Antwort bleibt unverändert.";
  const markup = renderToStaticMarkup(
    createElement(
      "article",
      null,
      createElement("p", null, answer),
      createElement(MiraAnswerActions, { meta, speaking: false, ...callbacks }, linkedActions()),
    ),
  );
  const details = markup.match(/<details\b[\s\S]*?<\/details>/)?.[0];
  assert.ok(details);
  assert.doesNotMatch(details.match(/<details[^>]*>/)![0], /\bopen(?:=|\s|>)/);
  assert.match(details, /<summary[^>]*aria-label="Technische Details"[^>]*>[\s\S]*?<svg/);
  for (const diagnostic of [
    "Anbieter für diese Antwort:",
    "Auswahlregel:",
    "das interne Backend ist nicht ausgewiesen",
    "Modellkennung:",
    meta.model,
    meta.routingReason,
  ]) {
    assert.ok(details.includes(diagnostic));
    assert.ok(!markup.replace(details, "").includes(diagnostic));
  }
  assert.ok(markup.replace(details, "").includes(answer));
});

test("all six actions are icon-only, named and titled, with large focusable targets", () => {
  const markup = renderToStaticMarkup(
    createElement(MiraAnswerActions, { meta, speaking: false, ...callbacks }, linkedActions()),
  );
  for (const label of [
    "Mit Mira besprechen",
    "Alo-Aktionen",
    "Technische Details",
    "Miras Antwort vorlesen",
    "Kopieren",
    "Merken",
  ]) {
    assert.ok(markup.includes(`aria-label="${label}"`));
    assert.ok(markup.includes(`title="${label}"`));
  }
  const controls = [...markup.matchAll(/<(button|summary)\b([^>]*)>([\s\S]*?)<\/\1>/g)];
  assert.equal(controls.length, 6);
  for (const [, , attributes, content] of controls) {
    assert.match(attributes, /min-h-11/);
    assert.match(attributes, /min-w-11/);
    assert.match(attributes, /focus-visible:ring-2/);
    assert.match(content, /<svg[^>]*aria-hidden="true"/);
    assert.equal(content.replace(/<[^>]*>/g, "").trim(), "");
  }
});

test("speech, copy and bookmark icon buttons invoke the supplied existing actions once", () => {
  const calls = { speak: 0, copy: 0, bookmark: 0 };
  const tree = MiraAnswerActions({
    meta,
    speaking: false,
    onSpeak: () => calls.speak++,
    onCopy: () => calls.copy++,
    onBookmark: () => calls.bookmark++,
  });
  const actions = Children.toArray(tree.props.children).filter(
    (child) => isValidElement(child) && child.type === ContentActionButton,
  );
  assert.equal(actions.length, 3);
  for (const action of actions) {
    assert.ok(isValidElement<Parameters<typeof ContentActionButton>[0]>(action));
    const button = ContentActionButton(action.props);
    button.props.onClick();
  }
  assert.deepEqual(calls, { speak: 1, copy: 1, bookmark: 1 });
});

test("chat and Alo icon triggers invoke their supplied handlers; default labels elsewhere remain", () => {
  for (const [icon, label] of [
    [MessageCircle, "Mit Mira besprechen"],
    [LayoutGrid, "Alo-Aktionen"],
  ] as const) {
    let calls = 0;
    const button = ContentActionButton({ iconOnly: true, icon, label, onClick: () => calls++ });
    button.props.onClick();
    assert.equal(calls, 1);
    const defaultMarkup = renderToStaticMarkup(
      createElement(ContentActionButton, { icon, label, onClick: noop }),
    );
    assert.ok(defaultMarkup.endsWith(`${label}</button>`));
  }
  const actions = read("components/alo/ContentActions.tsx");
  const handoff = read("components/alo/MiraHandoff.tsx");
  assert.match(
    actions,
    /<ContentActionButton[\s\S]*?label=\{triggerLabel\}[\s\S]*?onClick=\{\(\) => void begin\(\)\}/,
  );
  assert.match(actions, /<MiraHandoff[\s\S]*?iconOnly=\{iconOnly\}/);
  assert.match(
    handoff,
    /<ContentActionButton[\s\S]*?icon=\{MessageCircle\}[\s\S]*?onClick=\{begin\}/,
  );
  for (const source of [actions, handoff]) assert.match(source, /iconOnly = false/);
});

test("read-aloud keeps its accessible stop state and replies without metadata keep their actions", () => {
  const markup = renderToStaticMarkup(
    createElement(MiraAnswerActions, { speaking: true, ...callbacks }),
  );
  assert.match(markup, /aria-label="Miras Antwort stoppen"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /lucide-volume-x/);
  assert.doesNotMatch(markup, /<details|Miras Antwort vorlesen|Anbieter für diese Antwort/);
  assert.equal((markup.match(/<button\b/g) ?? []).length, 3);
});

test("both message layouts preserve original action inputs and their Nexus-draft availability", () => {
  const blocks = [...page.matchAll(/<MiraAnswerActions\b[\s\S]*?<\/MiraAnswerActions>/g)].map(
    (match) => match[0],
  );
  assert.equal(blocks.length, 2);
  for (const block of blocks) {
    assert.match(block, /meta=\{m\.meta\}/);
    assert.match(block, /speaking=\{speakingMessage === i\}/);
    assert.match(block, /onSpeak=\{\(\) => speakMiraMessage\(i, m\.content\)\}/);
    assert.match(block, /onCopy=\{\(\) => void copyText\(m\.content\)\}/);
    assert.match(
      block,
      /onBookmark=\{\(\) => setFavs\(toggleFavPrompt\(m\.content\.slice\(0, 120\)\)\)\}/,
    );
    assert.match(
      block,
      /userId && \([\s\S]*?<ContentActions[\s\S]*?text=\{m\.content\}[\s\S]*?source="Mira"[\s\S]*?iconOnly/,
    );
    assert.doesNotMatch(block, /Anbieter für diese Antwort:|Auswahlregel:|internes Backend/);
  }
  assert.match(blocks[0]!, /enableNexusDraft=\{m\.role === "assistant"\}/);
  assert.doesNotMatch(blocks[1]!, /enableNexusDraft/);
  assert.equal((page.match(/<MiraProgressiveAnswer\s+text=\{m\.content\}/g) ?? []).length, 2);
  for (const feature of ["MiraInteractiveCard", "MiraVisualAnswerCard", "MiraRunwareResult"])
    assert.equal((page.match(new RegExp(`<${feature}\\b`, "g")) ?? []).length, 2);
});

test("message layouts cannot bypass the shared closed details with old inline diagnostics", () => {
  assert.doesNotMatch(
    page,
    /Anbieter für diese Antwort:|das interne Backend ist nicht ausgewiesen/,
  );
  assert.doesNotMatch(page, /Auswahlregel: \{m\.meta\.routingReason\}/);
  assert.doesNotMatch(page, /\{m\.meta\.(?:provider|routingReason|model|task)\}/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  extractTikTokLinks,
  tiktokEmbedSrc,
  tiktokOEmbedUrl,
} from "../src/lib/link-embeds";

test("extrahiert mehrere TikTok-Links aus einer Nachricht", () => {
  const text = [
    "Schau mal:",
    "https://www.tiktok.com/@fussball/video/7301234567890123456",
    "und der hier https://vm.tiktok.com/ZMabcdef123/ ist auch gut.",
  ].join("\n");
  const links = extractTikTokLinks(text);
  assert.equal(links.length, 2);
  assert.equal(links[0].url, "https://www.tiktok.com/@fussball/video/7301234567890123456");
  assert.equal(links[0].videoId, "7301234567890123456");
  assert.equal(links[1].url, "https://vm.tiktok.com/ZMabcdef123/");
  assert.equal(links[1].videoId, null);
});

test("dedupliziert identische Links und entfernt Satzzeichen am Ende", () => {
  const text =
    "https://www.tiktok.com/@user/video/7301234567890123456. Und nochmal: https://www.tiktok.com/@user/video/7301234567890123456,";
  const links = extractTikTokLinks(text);
  assert.equal(links.length, 1);
  assert.equal(links[0].url, "https://www.tiktok.com/@user/video/7301234567890123456");
});

test("ignoriert Nicht-TikTok-URLs und leere Texte", () => {
  assert.deepEqual(extractTikTokLinks(""), []);
  assert.deepEqual(extractTikTokLinks("Kein Link hier."), []);
  const links = extractTikTokLinks(
    "https://www.youtube.com/watch?v=abc und https://example.com/tiktok-clone",
  );
  assert.deepEqual(links, []);
});

test("m- und www-Varianten werden erkannt, Embed-URL korrekt", () => {
  const links = extractTikTokLinks(
    "https://m.tiktok.com/v/7301234567890123456.html https://www.tiktok.com/@a/video/7309999999999999999",
  );
  assert.equal(links.length, 2);
  assert.equal(links[0].videoId, "7301234567890123456");
  assert.equal(tiktokEmbedSrc("7301234567890123456"), "https://www.tiktok.com/embed/v2/7301234567890123456");
  assert.ok(tiktokOEmbedUrl("https://vm.tiktok.com/abc/").includes("url=https%3A%2F%2Fvm.tiktok.com%2Fabc%2F"));
});

test("LocalChatShell bindet MessageLinkEmbeds ein (Regressionsschutz)", () => {
  const shell = readFileSync("src/components/chat/LocalChatShell.tsx", "utf8");
  assert.ok(shell.includes("MessageLinkEmbeds"), "LocalChatShell muss MessageLinkEmbeds rendern");
  assert.ok(
    /MessageLinkEmbeds content=\{m\.content\}/.test(shell),
    "Embeds müssen mit dem Nachrichteninhalt gerendert werden",
  );
});

test("Komponente und Logikdatei existieren", () => {
  assert.ok(existsSync("src/lib/link-embeds.ts"));
  assert.ok(existsSync("src/components/chat/MessageLinkEmbeds.tsx"));
  const component = readFileSync("src/components/chat/MessageLinkEmbeds.tsx", "utf8");
  assert.ok(component.includes("tiktokEmbedSrc"), "iFrame-Embed für Video-IDs erwartet");
  assert.ok(component.includes("ShortTikTokCard"), "Kurzlink-Fallback erwartet");
});

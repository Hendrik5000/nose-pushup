import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const game = readFileSync(
  resolve(process.cwd(), "private-game-preview/neon-starfighter.html"),
  "utf8",
);

test("Neon Starfighter: Alo-Branding, CSP und server-only-Marker", () => {
  assert.match(game, /<title>Neon Starfighter — Alo-Spiel<\/title>/);
  assert.match(game, /neon-starfighter-server-only-v2/);
  assert.match(game, /Content-Security-Policy/);
  assert.match(game, /Alo Arcade/);
  assert.match(game, /Alo-Spiel · Admin-Konto erforderlich/);
  assert.match(game, /Geschützte Admin-Auslieferung/);
  assert.match(game, /Spielstand nur für diese Sitzung/);
});

test("Neon Starfighter: keine externen Assets, kein Netzwerk, kein Speicher-Zugriff", () => {
  assert.doesNotMatch(game, /https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket/i);
  assert.doesNotMatch(game, /<(?:img|svg|audio|video|iframe)\b|data:image|@font-face/i);
  assert.doesNotMatch(game, /AudioContext|webkitAudioContext|\.play\s*\(/i);
  assert.doesNotMatch(game, /localStorage|sessionStorage|indexedDB/i);
});

test("Neon Starfighter: Arcade Command Center Feature-Umfang aus der Notion-Vorlage", () => {
  for (const marker of [
    "Interceptor",
    "Valkyrie Heavy",
    "Schild-Matrix",
    "Laser-Katalysator",
    "Combo-Prozessor",
    "Standard-Blaster",
    "Streu-Feuer",
    "Plasma-Railcore",
    "KI-Kern",
    "Pilotenname",
    "Erster Abschuss",
    "Kernbrecher",
    "Kettenkommando",
    "EMP",
    "Combo",
    "Credits",
    "Rang",
    "Sitzungsbest",
    "Mission starten",
    "Erneut starten",
    "Zum Hangar",
  ]) {
    assert.ok(game.includes(marker), `Spielfeature sollte enthalten sein: ${marker}`);
  }
});

test("Neon Starfighter: Boss, Hacking-Minigame und Wellenlogik vorhanden", () => {
  for (const marker of [
    "function spawnWave",
    "function startHack",
    "function tryHack",
    "function fireEmp",
    "function checkMissions",
    "function beginRun",
    "function endRun",
    "function toHangar",
    "function togglePause",
    "function aiAdvice",
    "BOSS IM ANFLUG",
    "wave%5===0",
  ]) {
    assert.ok(game.includes(marker), `Spiellogik sollte enthalten sein: ${marker}`);
  }
});

test("Neon Starfighter: responsive Steuerung und Barrierefreiheit", () => {
  assert.match(game, /@media \(max-width:\s*1000px\)/);
  assert.match(game, /@media \(max-width:\s*600px\)/);
  assert.match(game, /aria-live="polite"/);
  assert.match(game, /keys\.has\("ArrowUp"\).*ship\.y/);
  assert.match(game, /keys\.has\("ArrowDown"\).*ship\.y/);
  assert.match(game, /keys\.has\("w"\)/);
  assert.match(game, /keys\.has\("s"\)/);
  assert.match(game, /ship\.y=Math\.max\(\.18,Math\.min\(\.92,/);
  assert.match(game, /pointerdown/);
  assert.match(game, /touch-action:none/);
  assert.match(game, /aria-pressed/);
  assert.match(game, /role="tab"/);
});

test("Neon Starfighter: Vollbild-Canvas mit Overlay-HUD und Overlay-Bedienfeld", () => {
  assert.match(game, /body\{height:100dvh;overflow:hidden/);
  assert.match(game, /\.shell\{position:fixed;inset:0/);
  assert.match(game, /\.panel\{position:absolute;inset:0/);
  assert.match(game, /\.stage\{display:block;width:100%;height:100%\}/);
  assert.match(game, /\.top\{position:absolute[^}]*pointer-events:none/);
  assert.match(game, /\.statusline\{position:absolute[^}]*pointer-events:none/);
  assert.match(
    game,
    /\.overlay\{position:absolute;inset:0;z-index:10;background:#070b18d9;backdrop-filter:blur\(8px\)/,
  );
  assert.match(game, /\.actions\{position:absolute[^}]*bottom:14px[^}]*pointer-events:none/);
  assert.match(game, /pauseBtn\.hidden=false;resetBtn\.hidden=true/);
  assert.match(game, /pauseBtn\.hidden=true;resetBtn\.hidden=false/);
  assert.match(game, /last=performance\.now\(\);raf=requestAnimationFrame\(frame\);/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const game = readFileSync(resolve(process.cwd(), "private-game-preview/grid-defense.html"), "utf8");

test("the standalone game has public Alo branding and a complete tower-defense loop", () => {
  assert.match(game, /<title>Grid Defense — Alo-Spiel<\/title>/);
  assert.match(game, /grid-defense-server-only-v1/);
  assert.match(game, /<h1>Grid Defense<\/h1>/);
  for (const marker of [
    "const TOWER_TYPES =",
    "const ENEMY_TYPES =",
    "function makeWave",
    "function startWave",
    "function placeTower",
    "function hitEnemy",
    "Welle starten",
    "Türme feuern automatisch",
  ]) {
    assert.ok(game.includes(marker), `the standalone tower-defense loop should include ${marker}`);
  }

  for (const retiredName of ["Kronwacht", "Sturmfront", "Asterfall", "Rook", "Elara", "Torren"]) {
    assert.doesNotMatch(game, new RegExp(retiredName, "i"), `${retiredName} should not remain`);
  }
});

test("the game uses only its original canvas drawing with no external assets, audio or network", () => {
  assert.match(game, /<canvas id="board"/);
  assert.doesNotMatch(game, /https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket/i);
  assert.doesNotMatch(game, /<(?:img|svg|audio|video|iframe)\b|data:image|@font-face/i);
  assert.doesNotMatch(
    game,
    /AudioContext|webkitAudioContext|\b(?:sound|music|audio)\b|\.play\s*\(/i,
  );
  assert.doesNotMatch(game, /localStorage|sessionStorage/i);
});

test("the public game keeps responsive controls and clearly says no sign-in is needed", () => {
  assert.match(game, /@media \(max-width:\s*1000px\)/);
  assert.match(game, /@media \(max-width:\s*600px\)/);
  assert.match(game, /aria-live="polite"/);
  assert.match(game, /pointerdown/);
  assert.match(game, /Alo-Spiel · ohne Anmeldung/);
  assert.match(game, /Öffentliche Alo-Spielauslieferung/);
  assert.doesNotMatch(game, /Geschützte Admin-Auslieferung/);
  assert.match(game, /Spielstand nur für diese Sitzung/);
});

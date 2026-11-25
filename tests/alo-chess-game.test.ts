import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const root = process.cwd();
const chess = readFileSync(resolve(root, "private-game-preview/chess.html"), "utf8");
const policy = readFileSync(resolve(root, "src/lib/private-game-policy.ts"), "utf8");
const route = readFileSync(resolve(root, "src/routes/_authenticated/games.tsx"), "utf8");
const scriptBlocks = [...chess.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

class FakeElement {
  children: FakeElement[] = [];
  listeners = new Map<string, (event?: { currentTarget: FakeElement }) => void>();
  attributes = new Map<string, string>();
  classes = new Set<string>();
  className = "";
  textContent = "";
  hidden = false;
  disabled = false;
  value = "";
  dataset: Record<string, string> = {};
  scrollTop = 0;
  scrollHeight = 0;
  private html = "";
  readonly tagName: string;
  classList = { add: (...names: string[]) => names.forEach((name) => this.classes.add(name)) };

  constructor(tagName = "div") {
    this.tagName = tagName;
  }

  set innerHTML(value: string) {
    this.html = value;
    this.children = [];
  }

  get innerHTML() {
    return this.html;
  }

  append(child: FakeElement) {
    this.children.push(child);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  addEventListener(name: string, listener: (event?: { currentTarget: FakeElement }) => void) {
    this.listeners.set(name, listener);
  }

  dispatch(name: string) {
    this.listeners.get(name)?.({ currentTarget: this });
  }

  querySelectorAll() {
    return this.children;
  }
}

function bootChessPage() {
  assert.equal(scriptBlocks.length, 2, "the game should have only its bundled engine and game scripts");
  const ids = [
    "board",
    "status",
    "turn",
    "history",
    "notice",
    "description",
    "undo",
    "promotion",
    "opponent",
    "human-color-control",
    "human-color",
    "top-player",
    "bottom-player",
    "reset",
    "flip",
  ];
  const elements = new Map(ids.map((id) => [id, new FakeElement()]));
  elements.get("opponent")!.value = "local";
  elements.get("human-color")!.value = "w";
  elements.get("human-color-control")!.hidden = true;
  elements.get("promotion")!.children = ["q", "r", "b", "n"].map((piece) => {
    const button = new FakeElement("button");
    button.dataset.piece = piece;
    return button;
  });
  const document = {
    getElementById: (id: string) => elements.get(id) ?? null,
    createElement: (tagName: string) => new FakeElement(tagName),
  };
  const timers: Array<() => void> = [];
  const window: Record<string, any> = {
    setTimeout: (callback: () => void) => timers.push(callback),
  };
  const context = { document, window };
  runInNewContext(scriptBlocks[0], context);
  runInNewContext(scriptBlocks[1], context);
  return { elements, timers, window };
}

test("Alo chess remains registered in the authenticated Admin-only games hub", () => {
  assert.match(policy, /PRIVATE_GAME_IDS = \[/);
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    assert.ok(policy.includes(`"${id}"`));
  }
  assert.match(route, /getAdminAreaAccess\(\)/);
  assert.match(route, /game: "chess"/);
  assert.match(route, /title: "Alo Schach"/);
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter"])
    assert.ok(route.includes(id));
});

test("chess bundles the licensed rules engine and keeps the game offline and isolated", () => {
  assert.match(chess, /alo-chess-server-only-v1/);
  assert.match(chess, /Content-Security-Policy/);
  assert.match(chess, /connect-src 'none'/);
  assert.match(chess, /Copyright \(c\) 2025, Jeff Hlywa/);
  assert.match(chess, /Redistribution and use in source and binary forms/);
  assert.match(chess, /chess\.js 1\.4\.0/);
  assert.doesNotMatch(chess, /<script\s+[^>]*src=/i);
  assert.doesNotMatch(scriptBlocks[1], /fetch\s*\(|WebSocket|EventSource|supabase|localStorage/i);
  assert.match(chess, /aria-label="Schachbrett"/);
  assert.match(chess, /prefers-reduced-motion/);
  assert.match(chess, /prefers-color-scheme:light/);
  assert.match(chess, /@media\(max-width:740px\)/);
  assert.match(chess, /Gegen Mira \(lokaler Bot\)/);
  assert.match(chess, /window\.AloChessBot/);
  assert.match(chess, /game\.moves/);
  assert.match(chess, /isCheckmate/);
  assert.match(chess, /isStalemate/);
  assert.match(chess, /pending/);
});

test("the bundled page draws all 64 squares immediately and Mira can make an opening move", () => {
  const { elements, timers } = bootChessPage();
  const board = elements.get("board")!;
  assert.equal(board.children.length, 64);
  assert.equal(elements.get("history")!.textContent, "Noch keine Züge gespielt.");
  assert.equal(elements.get("status")!.textContent, "Partie läuft");

  elements.get("human-color")!.value = "b";
  elements.get("opponent")!.value = "mira";
  elements.get("opponent")!.dispatch("change");
  assert.equal(elements.get("human-color-control")!.hidden, false);
  assert.equal(timers.length, 1, "Mira should start as White when the player chooses Black");
  timers.shift()!();

  assert.equal(board.children.length, 64);
  assert.match(elements.get("notice")!.textContent, /^Mira spielt .+\.$/);
  assert.notEqual(elements.get("history")!.textContent, "Noch keine Züge gespielt.");
});

test("the local Mira bot returns legal moves without mutating the current position", () => {
  const { window } = bootChessPage();
  const game = new window.AloChess.Chess();
  const originalFen = game.fen();
  const opening = window.AloChessBot.chooseMove(game, "w");
  assert.ok(opening);
  assert.ok(
    game.moves({ verbose: true }).some((move: { from: string; to: string }) =>
      move.from === opening.from && move.to === opening.to,
    ),
  );
  assert.equal(game.fen(), originalFen);

  for (const color of ["w", "b", "w", "b"]) {
    const move = window.AloChessBot.chooseMove(game, color);
    assert.ok(move, `the bot should choose a legal move for ${color}`);
    assert.ok(game.move({ from: move.from, to: move.to, promotion: move.promotion }));
  }
  assert.equal(game.history().length, 4);
});

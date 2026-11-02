import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInitialBoard,
  getPiecePorts,
  isPowerConnected,
  rotatePiece,
} from "../src/lib/kupferkern";

test("Kupferkern starts with an unpowered route and five distinct turnable pieces", () => {
  const pieces = createInitialBoard();
  assert.equal(pieces.length, 5);
  assert.equal(isPowerConnected(pieces), false);
  assert.equal(new Set(pieces.map((piece) => piece.id)).size, 5);
});

test("rotating a corner advances clockwise without mutating the previous board", () => {
  const original = createInitialBoard();
  const rotated = rotatePiece(original, "western-elbow");
  const before = original.find((piece) => piece.id === "western-elbow");
  const after = rotated.find((piece) => piece.id === "western-elbow");

  assert.equal(before?.rotation, 0);
  assert.equal(after?.rotation, 1);
  assert.deepEqual(getPiecePorts(after!), ["E", "S"]);
  assert.notEqual(rotated, original);
});

test("only adjacent reciprocal ports conduct energy", () => {
  const initial = createInitialBoard();
  const oneTurn = rotatePiece(initial, "western-elbow");
  assert.equal(isPowerConnected(oneTurn), false);
});

test("the designed path powers the core when each segment points toward its neighbors", () => {
  let solved = createInitialBoard();
  const targetRotations: Record<string, number> = {
    "western-elbow": 3,
    "northwest-elbow": 1,
    "north-straight": 1,
    "northeast-elbow": 2,
    "eastern-elbow": 0,
  };

  for (const piece of solved) {
    const turns = (targetRotations[piece.id]! - piece.rotation + 4) % 4;
    for (let count = 0; count < turns; count += 1) solved = rotatePiece(solved, piece.id);
  }

  assert.equal(isPowerConnected(solved), true);
});

test("an unknown tile id is a safe no-op", () => {
  const original = createInitialBoard();
  assert.equal(rotatePiece(original, "missing-piece"), original);
});

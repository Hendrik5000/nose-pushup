import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateInviteCode,
  getInviteJoinErrorMessage,
  isValidInviteCode,
  normalizeInviteCode,
} from "../src/lib/invite-code";

function withCrypto(value: unknown, run: () => void): void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    writable: true,
    value,
  });

  try {
    run();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }
  }
}

test("generateInviteCode uses 16 secure bytes and returns 32 uppercase hex characters", () => {
  const expectedBytes = Uint8Array.from([
    0x00, 0x01, 0x0a, 0x0f, 0x10, 0x1f, 0x20, 0x2a, 0x3b, 0x4c, 0x5d, 0x6e, 0x7f, 0x80, 0xfe, 0xff,
  ]);
  let calls = 0;

  withCrypto(
    {
      getRandomValues(bytes: Uint8Array) {
        calls += 1;
        assert.ok(bytes instanceof Uint8Array);
        assert.equal(bytes.length, 16);
        bytes.set(expectedBytes);
        return bytes;
      },
    },
    () => {
      const code = generateInviteCode();
      assert.equal(code, "00010A0F101F202A3B4C5D6E7F80FEFF");
      assert.match(code, /^[0-9A-F]{32}$/);
      assert.equal(calls, 1);
    },
  );
});

test("generateInviteCode fails closed without secure crypto and never falls back to Math.random", () => {
  const originalRandom = Math.random;
  let randomCalls = 0;
  Math.random = () => {
    randomCalls += 1;
    throw new Error("Math.random must not be used");
  };

  try {
    withCrypto(undefined, () => {
      assert.throws(() => generateInviteCode(), /Sichere Zufallszahlen/);
    });
    withCrypto(
      {
        getRandomValues() {
          throw new Error("secure RNG failed");
        },
      },
      () => assert.throws(() => generateInviteCode(), /secure RNG failed/),
    );
    assert.equal(randomCalls, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test("normalizeInviteCode removes whitespace and hyphens and uppercases grouped input", () => {
  assert.equal(
    normalizeInviteCode(" abcd-1234\n ef01-2345 6789-abcd ef01-2345 "),
    "ABCD1234EF0123456789ABCDEF012345",
  );
  assert.equal(
    normalizeInviteCode("0000-0000-0000-0000-0000-0000-0000-0000"),
    "00000000000000000000000000000000",
  );
});

test("normalizeInviteCode rejects non-strings and input longer than 128 characters without coercion", () => {
  const hostileValue = {
    toString() {
      throw new Error("must not coerce");
    },
  };
  assert.equal(normalizeInviteCode(null), "");
  assert.equal(normalizeInviteCode(undefined), "");
  assert.equal(normalizeInviteCode(123), "");
  assert.equal(normalizeInviteCode(hostileValue), "");
  assert.equal(normalizeInviteCode("A".repeat(129)), "");
  assert.equal(normalizeInviteCode("A".repeat(128)), "A".repeat(128));
});

test("isValidInviteCode accepts exactly 32 uppercase ASCII hex characters, not legacy or malformed codes", () => {
  assert.equal(isValidInviteCode("0123456789ABCDEF0123456789ABCDEF"), true);
  assert.equal(isValidInviteCode("ABCDEF"), false);
  assert.equal(isValidInviteCode("ABCDEFGH"), false);
  assert.equal(isValidInviteCode("0123456789abcdef0123456789abcdef"), false);
  assert.equal(isValidInviteCode("0123456789ABCDEG0123456789ABCDEF"), false);
  assert.equal(
    isValidInviteCode("０１２３４５６７８９ＡＢＣＤＥＦ０１２３４５６７８９ＡＢＣＤＥＦ"),
    false,
  );
  assert.equal(isValidInviteCode("0123456789ABCDEF0123456789ABCDE"), false);
  assert.equal(isValidInviteCode("0123456789ABCDEF0123456789ABCDEFF"), false);
  assert.equal(isValidInviteCode("01234567-89ABCDEF-0123456789ABCDEF"), false);
  assert.equal(isValidInviteCode(123 as unknown as string), false);
});

test("getInviteJoinErrorMessage maps only recognized codes to safe German messages", () => {
  const rateLimit = getInviteJoinErrorMessage({ code: "RATE_LIMITED" });
  assert.match(rateLimit, /8-mal pro Minute/);
  assert.match(rateLimit, /warte eine Minute/);
  assert.equal(
    getInviteJoinErrorMessage(new Error("UNAUTHORIZED")),
    "Du bist nicht berechtigt, diesem Battle oder Club beizutreten.",
  );
  assert.match(getInviteJoinErrorMessage({ message: "INVALID_CODE_FORMAT" }), /ungültiges Format/);

  const notFound = getInviteJoinErrorMessage("NOT_FOUND");
  assert.equal(getInviteJoinErrorMessage("BATTLE_NOT_FOUND"), notFound);
  assert.equal(getInviteJoinErrorMessage("CLUB_NOT_FOUND"), notFound);
  assert.match(getInviteJoinErrorMessage({ code: "CLUB_FULL" }), /Club ist voll/);
});

test("getInviteJoinErrorMessage never returns unknown technical text or interpolates details", () => {
  const privateTechnicalDetail = "postgres://secret-host:5432/db; stack trace";
  const fallback = getInviteJoinErrorMessage(new Error(privateTechnicalDetail));
  assert.equal(
    fallback,
    "Der Beitritt ist fehlgeschlagen. Bitte prüfe den Einladungscode und versuche es erneut.",
  );
  assert.equal(fallback.includes(privateTechnicalDetail), false);
  assert.equal(
    getInviteJoinErrorMessage({
      code: "P0001",
      message: `CLUB_FULL: ${privateTechnicalDetail}`,
    }),
    fallback,
  );
  assert.equal(getInviteJoinErrorMessage(null), fallback);
  assert.equal(getInviteJoinErrorMessage({ toString: () => privateTechnicalDetail }), fallback);
});

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createECDH } from "node:crypto";
import test from "node:test";
import {
  decodeVapidPublicKey,
  isVapidPublicKeyConfigured,
  validateVapidPublicKey,
} from "../src/lib/vapid";

const INVALID_LEGACY_KEY =
  "BEl62vp9IHZisv938A96792I37S0H479S4522409579304957930495793049579304957930495793";

test("rejects a missing or malformed VAPID key before subscription", () => {
  assert.equal(isVapidPublicKeyConfigured(""), false);
  assert.throws(() => decodeVapidPublicKey(INVALID_LEGACY_KEY), /VAPID-Public-Key/);
});

test("accepts and validates a real uncompressed P-256 public point", async () => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const publicKey = ecdh.getPublicKey("base64url");

  const decoded = await validateVapidPublicKey(publicKey);
  assert.equal(decoded.length, 65);
  assert.equal(decoded[0], 0x04);
  assert.equal(isVapidPublicKeyConfigured(publicKey), true);
});

test("rejects a 65-byte uncompressed value that is not on the P-256 curve", async () => {
  const invalidPoint = Buffer.alloc(65);
  invalidPoint[0] = 0x04;
  const publicKey = invalidPoint.toString("base64url");

  assert.equal(isVapidPublicKeyConfigured(publicKey), true);
  await assert.rejects(validateVapidPublicKey(publicKey), /VAPID-Public-Key/);
});

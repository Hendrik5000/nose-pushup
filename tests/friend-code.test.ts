import assert from "node:assert/strict";
import test from "node:test";
import {
  FRIEND_CODE_ALPHABET,
  describeFriendCodeProblem,
  formatFriendCode,
  formatFriendCodeInput,
  isValidFriendCode,
  normalizeFriendCode,
} from "../src/lib/friends/friend-code";

test("alphabet has 31 symbols without look-alikes", () => {
  assert.equal(FRIEND_CODE_ALPHABET.length, 31);
  for (const char of "ILO01") assert.ok(!FRIEND_CODE_ALPHABET.includes(char));
});

test("normalize ignores case, spaces and dashes", () => {
  assert.equal(normalizeFriendCode(" k7qm-2xrt "), "K7QM2XRT");
  assert.equal(normalizeFriendCode("k7qm 2xrt"), "K7QM2XRT");
});

test("valid codes have exactly 8 allowed characters", () => {
  assert.ok(isValidFriendCode("K7QM-2XRT"));
  assert.ok(isValidFriendCode("k7qm2xrt"));
  assert.ok(!isValidFriendCode("K7QM-2XR"));
  assert.ok(!isValidFriendCode("K7QM-2XRTT"));
  assert.ok(!isValidFriendCode("K7QM-2XR0"));
  assert.ok(!isValidFriendCode("K7QM-2XRL"));
  assert.ok(!isValidFriendCode(""));
});

test("format inserts a dash only for valid codes", () => {
  assert.equal(formatFriendCode("k7qm2xrt"), "K7QM-2XRT");
  assert.equal(formatFriendCode("k7q"), "K7Q");
});

test("live input formatting caps the length and adds the dash after four characters", () => {
  assert.equal(formatFriendCodeInput("k7"), "K7");
  assert.equal(formatFriendCodeInput("k7qm2"), "K7QM-2");
  assert.equal(formatFriendCodeInput("k7qm2xrtabc"), "K7QM-2XRT");
});

test("problems are described for the UI", () => {
  assert.equal(describeFriendCodeProblem(""), "empty");
  assert.equal(describeFriendCodeProblem("K7QM"), "too_short");
  assert.equal(describeFriendCodeProblem("K7QM2XRT9"), "too_long");
  assert.equal(describeFriendCodeProblem("K7QM2XR0"), "bad_characters");
  assert.equal(describeFriendCodeProblem("K7QM2XRT"), null);
});

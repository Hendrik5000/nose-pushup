import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("guest Postfach hides friend features and provides an account security link", () => {
  const root = process.cwd();
  const page = readFileSync(resolve(root, "src/components/postfach/PostfachPage.tsx"), "utf8");
  const provider = readFileSync(
    resolve(root, "src/components/postfach/PostfachProvider.tsx"),
    "utf8",
  );

  assert.match(provider, /isGuest: boolean/);
  assert.match(page, /if \(postfach\.isGuest\)/);
  assert.match(page, /function PostfachHeader\(\{ isGuest \}/);
  assert.match(page, /isGuest \? \(/);
  assert.match(page, /to="\/settings\/\$category"/);
  assert.match(page, /params=\{\{ category: "profile" \}\}/);
  assert.match(page, /Konto sichern/);

  const guestBranch = page.indexOf("if (postfach.isGuest)");
  const regularBranch = page.indexOf("\n  return (", guestBranch);
  const friendCodeCard = page.indexOf("<FriendCodeCard />");
  assert.ok(guestBranch >= 0, "guest content should use a dedicated return path");
  assert.ok(regularBranch > guestBranch, "the guest path should return before regular content");
  assert.ok(
    friendCodeCard > regularBranch,
    "friend features should be limited to regular accounts",
  );
});

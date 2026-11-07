import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeNext } from "../src/lib/safe-next.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("post-auth destinations stay same-origin and reject URL normalization bypasses", () => {
  assert.equal(safeNext("/training?day=today#history"), "/training?day=today#history");
  assert.equal(safeNext("/profile/../health"), "/health");
  assert.equal(safeNext("/a/..//attacker.example"), "/");
  assert.equal(safeNext("/%2e//attacker.example"), "/");
  assert.equal(safeNext("/%2e%2e//attacker.example"), "/");
  assert.equal(safeNext("//attacker.example/path"), "/");
  assert.equal(safeNext("https://attacker.example/path"), "/");
  assert.equal(safeNext(`/${String.fromCharCode(92)}attacker.example/path`), "/");
  assert.equal(safeNext("/profile\nhttps://attacker.example"), "/");
  assert.equal(safeNext(null), "/");
});

test("notification preferences are native keyboard-operable toggle buttons", () => {
  const source = read("components/NotificationSettings.tsx");
  assert.match(
    source,
    /<button\s+type="button"\s+onClick=\{\(\) => void toggleLocal\(\)\}\s+aria-pressed=\{enabled\}/,
  );
  assert.match(
    source,
    /<button\s+type="button"\s+onClick=\{\(\) => void togglePush\(\)\}\s+aria-pressed=\{pushEnabled\}\s+disabled=\{loading\}/,
  );
  assert.doesNotMatch(source, /<div\s+onClick=/);
});

test("readable content remains selectable without making interactive controls selectable", () => {
  const styles = read("styles.css");
  const chat = read("components/chat/LocalChatShell.tsx");
  const bodyBlocks = [...styles.matchAll(/body\s*\{([^}]*)\}/g)].map((match) => match[1]);
  const bodyWithTypography = bodyBlocks.find((block) => block.includes("font-family:"));
  assert.ok(bodyWithTypography, "expected the app body style block");
  assert.doesNotMatch(bodyWithTypography, /user-select:\s*none/);
  assert.match(
    styles,
    /:where\(button,\s*\[role="button"\],\s*a,\s*summary\)\s*\{\s*user-select:\s*none;/,
  );
  assert.match(chat, /whitespace-pre-wrap break-words select-text/);
});

test("Health history distinguishes loading, query errors, retry, and a true empty result", () => {
  const source = read("routes/_authenticated/health.tsx");
  assert.match(source, /const \[historyLoading, setHistoryLoading\] = useState\(true\)/);
  assert.match(source, /const \{ data, error \} = await supabase/);
  assert.match(source, /if \(error\) throw error/);
  assert.match(source, /setHistoryError\("Der Verlauf konnte nicht geladen werden\."\)/);
  assert.match(source, /role="status"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /Erneut versuchen/);
  assert.match(source, /historyLoading \|\| historyError \|\| entries\.length === 0/);
});

test("friend and sent-request load failures are recoverable, not empty-list states", () => {
  const source = read("components/FriendsPanel.tsx");
  assert.match(source, /setFriendsError\("Die Freundesliste konnte nicht geladen werden\."\)/);
  assert.match(source, /Einladungen konnten nicht geladen werden\./);
  assert.match(source, /friendsError \? \(/);
  assert.match(source, /sentError \? \(/);
  assert.match(source, /function RetryMessage\(/);
  assert.match(source, /role="alert"/);
  assert.match(source, /Erneut versuchen/);
});

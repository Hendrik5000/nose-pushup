import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("private game server serves only the local sanitized document with a restrictive CSP", async (t) => {
  const child = spawn(process.execPath, ["scripts/serve-private-game.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, ALO_PRIVATE_GAME_PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill("SIGTERM"));

  let output = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const origin = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server start timeout: ${stderr}`)), 5_000);
    const onData = (chunk: string) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before listening (${code}): ${stderr}`));
    });
  });

  const page = await fetch(`${origin}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
  assert.match(page.headers.get("content-security-policy") ?? "", /img-src 'none'/);
  assert.match(page.headers.get("content-security-policy") ?? "", /font-src 'none'/);
  assert.match(page.headers.get("content-security-policy") ?? "", /script-src 'unsafe-inline'/);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.match(await page.text(), /Grid Defense/);

  const hiddenPath = await fetch(`${origin}/private-game-preview/grid-defense.html`);
  assert.equal(hiddenPath.status, 404);
  const health = await fetch(`${origin}/health`);
  assert.deepEqual(await health.json(), { ok: true, scope: "loopback-private-preview" });
});

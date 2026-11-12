import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const publicDirectory = resolve(process.cwd(), ".output/public");

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

test(
  "production public assets contain neither private game payload marker nor standalone game file",
  { skip: !existsSync(publicDirectory) },
  () => {
    const files = listFiles(publicDirectory);
    assert.ok(files.length > 0, "the production public output should exist after build");
    const publicText = files.map((file) => readFileSync(file).toString("utf8")).join("\n");

    for (const marker of [
      "grid-defense-server-only-v1",
      "kupferkern-server-only-v1",
      "western-elbow",
      "isPowerConnected",
      "const TOWER_TYPES =",
    ]) {
      assert.ok(!publicText.includes(marker), `${marker} must not occur in public assets`);
    }
    for (const file of files) {
      assert.ok(!/\/(?:grid-defense|kupferkern)\.html$/i.test(file), `${file} must not be public`);
    }
  },
);

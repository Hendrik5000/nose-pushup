import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const publicDirectory = resolve(process.cwd(), ".output/public");
const requireProductionBuild = process.env.REQUIRE_PRIVATE_GAME_BUILD === "1";

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

test(
  "production public assets contain neither private game payload marker nor standalone game file",
  { skip: !requireProductionBuild && !existsSync(publicDirectory) },
  () => {
    assert.ok(existsSync(publicDirectory), "the production public output should exist after build");
    const files = listFiles(publicDirectory);
    assert.ok(files.length > 0, "the production public output should exist after build");
    const publicText = files.map((file) => readFileSync(file).toString("utf8")).join("\n");

    const privateGameSentinels = [
      ["grid-defense.html", "grid-defense-server-only-v1"],
      ["kupferkern.html", "kupferkern-server-only-v1"],
      ["neon-starfighter.html", "neon-starfighter-server-only-v2"],
      ["chess.html", "alo-chess-server-only-v1"],
    ] as const;
    for (const [gameFile, marker] of privateGameSentinels) {
      const source = readFileSync(resolve(process.cwd(), "private-game-preview", gameFile), "utf8");
      assert.ok(source.includes(marker), `${gameFile} must keep its private payload sentinel`);
    }
    for (const marker of [
      ...privateGameSentinels.map(([, marker]) => marker),
      "western-elbow",
      "isPowerConnected",
      "const TOWER_TYPES =",
    ]) {
      assert.ok(!publicText.includes(marker), `${marker} must not occur in public assets`);
    }
    for (const file of files) {
      assert.ok(
        !/\/(?:grid-defense|kupferkern|neon-starfighter|chess)\.html$/i.test(file),
        `${file} must not be public`,
      );
    }
  },
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ALO_WORKSPACE_TOOLS, HOME_OTHER_AREAS } from "../src/lib/home-app-menus.ts";

const areasRoute = readFileSync(
  resolve(process.cwd(), "src/routes/_authenticated/areas.tsx"),
  "utf8",
);
const toolsRoute = readFileSync(
  resolve(process.cwd(), "src/routes/_authenticated/tools.tsx"),
  "utf8",
);
const workspace = readFileSync(
  resolve(process.cwd(), "src/components/alo/AloWorkspace.tsx"),
  "utf8",
);

test("the dedicated Further Areas app keeps all ten original routes", () => {
  assert.deepEqual(
    HOME_OTHER_AREAS.map(({ to }) => to),
    [
      "/health",
      "/programs",
      "/calisthenics",
      "/run",
      "/season",
      "/battle",
      "/battle-league",
      "/leaderboard",
      "/clubs",
      "/alarm",
    ],
  );
  assert.match(areasRoute, /createFileRoute\("\/_authenticated\/areas"\)/);
  assert.match(areasRoute, /HOME_OTHER_AREAS\.map/);
  assert.match(areasRoute, /<Link[\s\S]*?to=\{to\}/);
  assert.match(areasRoute, /aria-label="Alle weiteren Alo-Bereiche"/);
});

test("the dedicated Tools app exposes every current workspace action and opens its existing tab", () => {
  assert.deepEqual(
    ALO_WORKSPACE_TOOLS.map(({ id }) => id),
    ["today", "search", "capture", "collections", "shortcuts", "privacy"],
  );
  assert.match(toolsRoute, /createFileRoute\("\/_authenticated\/tools"\)/);
  assert.match(toolsRoute, /orderedTools\.map/);
  assert.match(toolsRoute, /new CustomEvent\("alo-open", \{ detail: toolId \}\)/);
  assert.match(workspace, /ALO_WORKSPACE_TOOLS as TABS/);
  assert.match(workspace, /setTab\(next\)/);
});

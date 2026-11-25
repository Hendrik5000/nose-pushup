import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const mira = readFileSync(resolve(root, "src/components/mira/SuperAiPage.tsx"), "utf8");
const settingsRoute = readFileSync(
  resolve(root, "src/routes/_authenticated/settings.$category.tsx"),
  "utf8",
);
const profile = readFileSync(
  resolve(root, "src/routes/_authenticated/profile-page-impl.tsx"),
  "utf8",
);

test("Mira provides a direct link to the existing Friends community page", () => {
  const menuStart = mira.indexOf('<details className="mira-chat-view-menu">');
  const menuEnd = mira.indexOf("</details>", menuStart);
  assert.ok(menuStart >= 0 && menuEnd > menuStart, "Mira's views-and-tools menu should exist");
  const menu = mira.slice(menuStart, menuEnd);

  assert.match(
    menu,
    /<Link[\s\S]*?to="\/settings\/\$category"[\s\S]*?params=\{\{ category: "community" \}\}[\s\S]*?>\s*Freunde verwalten\s*<\/Link>/,
  );
  assert.match(settingsRoute, /isProfileSettingsCategory\(params\.category\)/);
  assert.match(profile, /case "community":[\s\S]*?<FriendsPanel userId=\{profile\.id\} \/>/);
});

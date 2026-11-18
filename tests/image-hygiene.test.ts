import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

test("list avatars and previews lazy-load; overlays stay instant", () => {
  const lazyFiles = [
    "src/routes/_authenticated/battle-league.tsx",
    "src/routes/_authenticated/leaderboard.tsx",
    "src/routes/_authenticated/profile-page-impl.tsx",
    "src/routes/u.$slug.tsx",
    "src/components/postfach/PostfachPage.tsx",
    "src/components/FriendsPanel.tsx",
    "src/components/chat/NexusFriendFeatures.tsx",
    "src/components/alo/AloWorkspace.tsx",
    "src/components/alo/QuickCapture.tsx",
  ];
  for (const file of lazyFiles) {
    const source = readFileSync(resolve(repoRoot, file), "utf8");
    assert.match(source, /loading="lazy"/, `${file} soll Listen-Bilder lazy laden.`);
    assert.doesNotMatch(
      source,
      /loading="lazy"\s*\n[^\n]*loading="lazy"/,
      `${file}: keine doppelten Attribute.`,
    );
  }

  const callDialog = readFileSync(
    resolve(repoRoot, "src/components/calls/IncomingCallDialog.tsx"),
    "utf8",
  );
  const callOverlay = readFileSync(
    resolve(repoRoot, "src/components/calls/ActiveCallOverlay.tsx"),
    "utf8",
  );
  for (const [name, source] of [
    ["IncomingCallDialog", callDialog],
    ["ActiveCallOverlay", callOverlay],
  ] as const) {
    assert.match(source, /decoding="async"/, `${name} decodiert asynchron.`);
    assert.doesNotMatch(source, /loading="lazy"/, `${name} darf Anrufe-Avatare nicht aufschieben.`);
  }
});

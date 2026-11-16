import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  listMiraMarketplaceDrafts,
  miraMarketplaceDraftRecordId,
  removeMiraMarketplaceDraft,
} from "../src/lib/mira-marketplace-drafts";

test("mira marketplace draft listing stays honest without a user", () => {
  assert.deepEqual(listMiraMarketplaceDrafts(""), []);
  removeMiraMarketplaceDraft("", "session-1");
  removeMiraMarketplaceDraft("user-1", "  ");
  assert.equal(miraMarketplaceDraftRecordId("session-1"), "mira-marketplace-draft:session-1");
});

test("the drafts panel lists persisted drafts and stays creator-only", () => {
  const root = process.cwd();
  const panel = readFileSync(
    resolve(root, "src/components/mira/MiraMarketplaceDraftsPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /Meine App-Entwürfe/);
  assert.match(panel, /listMiraMarketplaceDrafts/);
  assert.match(panel, /removeMiraMarketplaceDraft/);
  assert.match(panel, /onOpenSession/);
  assert.match(panel, /Noch keine App-Entwürfe\./);
  assert.match(panel, /nur für dich sichtbar/);
  assert.match(panel, /admin-geprüft/);
  assert.match(panel, /endgültig löschen/);
});

test("the Mira page embeds the drafts overview next to the chat history", () => {
  const root = process.cwd();
  const page = readFileSync(resolve(root, "src/components/mira/SuperAiPage.tsx"), "utf8");
  assert.match(page, /MiraMarketplaceDraftsPanel/);
  assert.match(page, /sessionsOpen && userId && \(/);
  assert.match(page, /onOpenSession=\{\(sessionId\) => switchSession\(sessionId\)\}/);
});

test("draft listing validates manifests and skips broken records", () => {
  const lib = readFileSync(resolve(process.cwd(), "src/lib/mira-marketplace-drafts.ts"), "utf8");
  assert.match(lib, /validateMarketplaceAuthoredManifest/);
  assert.match(lib, /target === "mira-marketplace"/);
  assert.match(lib, /catch \{\s*return null;\s*\}/);
  assert.match(lib, /b\.updatedAt\.localeCompare\(a\.updatedAt\)/);
});

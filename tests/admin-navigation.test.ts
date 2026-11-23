import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const adminRoute = readFileSync(
  resolve(root, "src/routes/_authenticated/admin.tsx"),
  "utf8",
);
const releasePanel = readFileSync(
  resolve(root, "src/components/admin/FeatureReleaseDigestPanel.tsx"),
  "utf8",
);

test("Admin offers responsive links to existing sections without weakening its access gate", () => {
  assert.match(adminRoute, /<HomeAppMenuSidebar\s+ariaLabel="Admin-Navigation"/);
  assert.match(adminRoute, /<nav\s+aria-label="Admin-Bereiche"/);
  assert.match(adminRoute, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(adminRoute, /mt-3 flex flex-wrap gap-2 lg:flex-col/);
  assert.match(adminRoute, /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  assert.match(adminRoute, /href="#feature-release-digest-title"/);
  assert.match(releasePanel, /id="feature-release-digest-title"/);
  assert.match(
    adminRoute,
    /roleAccess\?\.canManage && \([\s\S]*?href="#admin-role-management-title"/,
  );
  assert.match(adminRoute, /id="admin-role-management-title"/);
  assert.equal((adminRoute.match(/roleAccess\?\.canManage && \(/gu) ?? []).length, 2);
  assert.match(
    adminRoute,
    /beforeLoad: async \(\) => \{\s*if \(!\(await getAdminAreaAccess\(\)\)\) throw redirect\(\{\s*to: "\/"\s*\}\);/,
  );
});

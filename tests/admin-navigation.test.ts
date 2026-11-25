import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const adminRoute = readFileSync(resolve(root, "src/routes/_authenticated/admin.tsx"), "utf8");
const homeRoute = readFileSync(resolve(root, "src/routes/_authenticated/index.tsx"), "utf8");
const releasePanel = readFileSync(
  resolve(root, "src/components/admin/FeatureReleaseDigestPanel.tsx"),
  "utf8",
);

test("Admin offers responsive links to existing sections without weakening its access gate", () => {
  assert.match(adminRoute, /<HomeAppMenuSidebar\s+ariaLabel="Admin-Navigation"/);
  assert.match(adminRoute, /<nav\s+aria-label="Admin-Bereiche"/);
  assert.match(adminRoute, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(adminRoute, /mt-3 flex flex-wrap gap-2 lg:flex-col/);
  assert.match(
    adminRoute,
    /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/,
  );
  assert.match(adminRoute, /href="#feature-release-digest-title"/);
  assert.match(releasePanel, /id="feature-release-digest-title"/);
  assert.match(
    adminRoute,
    /roleAccess\?\.canManage && \([\s\S]*?href="#admin-role-management-title"/,
  );
  assert.match(adminRoute, /id="admin-role-management-title"/);
  assert.equal((adminRoute.match(/roleAccess\?\.canManage && \(/gu) ?? []).length, 2);
  const deniedGuardStart = adminRoute.indexOf("beforeLoad: async");
  const deniedGuardEnd = adminRoute.indexOf("component: AdminOverview", deniedGuardStart);
  const deniedGuard = adminRoute.slice(deniedGuardStart, deniedGuardEnd);
  assert.ok(deniedGuardStart >= 0 && deniedGuardEnd > deniedGuardStart);
  assert.match(deniedGuard, /getAdminAreaAccess\(\)/);
  assert.match(deniedGuard, /markAdminAccessDeniedNotice\(\(\) => window\.sessionStorage\)/);
  assert.match(deniedGuard, /throw redirect\(\{\s*to: "\/"\s*\}\)/);
  const noticeStart = homeRoute.indexOf("adminAccessNoticeVisible && (");
  const noticeEnd = homeRoute.indexOf("<header", noticeStart);
  const homeNotice = homeRoute.slice(noticeStart, noticeEnd);
  assert.ok(noticeStart >= 0 && noticeEnd > noticeStart);
  assert.match(homeNotice, /role="status"/);
  assert.match(homeNotice, /aria-live="polite"/);
  assert.match(homeNotice, /ADMIN_ACCESS_DENIED_NOTICE/);
  assert.match(
    homeRoute,
    /consumeAdminAccessDeniedNotice\(\(\) => window\.sessionStorage\)/,
  );
});

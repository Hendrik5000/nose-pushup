import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  isMarketplaceAdminIdentity,
  isMarketplaceAdminRoleResult,
  parseMarketplacePublishRequest,
} from "../src/lib/marketplace.functions";
import { MARKETPLACE_AUTHOR_ACTIONS } from "../src/lib/marketplace";
import { MARKETPLACE_ICON_IDS } from "../src/lib/marketplace-authoring";

const root = process.cwd();
const migrationName = "20261106223000_marketplace_authoring_v1.sql";
const migration = readFileSync(`${root}/supabase/migrations/${migrationName}`, "utf8");
const gameMigrationName = "20261107104500_marketplace_declarative_quiz_v2.sql";
const gameMigration = readFileSync(`${root}/supabase/migrations/${gameMigrationName}`, "utf8");
const serverFunctions = readFileSync(`${root}/src/lib/marketplace.functions.ts`, "utf8");
const authoringComponent = readFileSync(
  `${root}/src/components/marketplace/MarketplaceCustomApps.tsx`,
  "utf8",
);
const appViewer = readFileSync(
  `${root}/src/components/marketplace/MarketplacePublishedAppViewer.tsx`,
  "utf8",
);
const appRuntime = readFileSync(`${root}/src/lib/marketplace-runtime.ts`, "utf8");
const miraChat = readFileSync(`${root}/src/components/mira/SuperAiPage.tsx`, "utf8");
const draftPreview = readFileSync(
  `${root}/src/components/marketplace/MiraMarketplaceDraftPreview.tsx`,
  "utf8",
);
const manifestRenderer = readFileSync(
  `${root}/src/components/marketplace/MarketplaceManifestView.tsx`,
  "utf8",
);
const route = readFileSync(`${root}/src/routes/_authenticated/marketplace.tsx`, "utf8");

const VALID_MANIFEST = {
  schemaVersion: 1,
  name: "Trainingsstart",
  description: "Öffnet den vorhandenen Trainingsbereich.",
  icon: "training",
  blocks: [
    { type: "heading", text: "Los geht's" },
    { type: "action", label: "Programme", actionId: "route:/programs" },
  ],
};

test("server authorization requires a real user and an exact database-verified global Admin result", () => {
  assert.equal(isMarketplaceAdminIdentity("user-1", false), true);
  assert.equal(isMarketplaceAdminIdentity("user-1", "false"), true);
  assert.equal(isMarketplaceAdminIdentity("user-1", true), false);
  assert.equal(isMarketplaceAdminIdentity("user-1", "true"), false);
  assert.equal(isMarketplaceAdminIdentity("", false), false);
  assert.equal(isMarketplaceAdminIdentity(null, false), false);
  assert.equal(isMarketplaceAdminRoleResult(true, null), true);
  for (const denied of [false, "true", 1, null, undefined]) {
    assert.equal(isMarketplaceAdminRoleResult(denied, null), false);
  }
  assert.equal(isMarketplaceAdminRoleResult(true, new Error("RPC failed")), false);

  for (const name of [
    "listMarketplaceCurrentApps",
    "getMarketplaceAppVersion",
    "publishMarketplaceApp",
    "revokeMarketplaceApp",
  ]) {
    assert.match(serverFunctions, new RegExp(`export const ${name} = createServerFn`));
    const start = serverFunctions.indexOf(`export const ${name} = createServerFn`);
    const next = serverFunctions.indexOf("export const ", start + 20);
    const source = serverFunctions.slice(start, next < 0 ? undefined : next);
    assert.match(source, /\.middleware\(\[requireSupabaseAuth\]\)/);
    assert.match(source, /await requireMarketplaceAdmin\(context as ServerAuthContext\)/);
  }
  assert.match(serverFunctions, /has_global_role" as never/);
  assert.match(serverFunctions, /p_role_name: "admin"/);
  assert.doesNotMatch(
    serverFunctions,
    /ADMIN_ROLE_MANAGER_USER_ID|grant_global_role|revoke_global_role|list_admin_role_assignments/,
  );
  assert.doesNotMatch(serverFunctions, /data\.(role|isAdmin|is_admin)/i);
});

test("publish and revoke request validators fail closed unless the Admin explicitly confirms", () => {
  const initial = parseMarketplacePublishRequest({ manifest: VALID_MANIFEST, confirmed: true });
  assert.equal(initial.confirmed, true);
  assert.equal(initial.appId, undefined);
  assert.throws(
    () => parseMarketplacePublishRequest({ manifest: VALID_MANIFEST, confirmed: false }),
    /Bestätigung/,
  );
  assert.throws(() => parseMarketplacePublishRequest({ manifest: VALID_MANIFEST }), /Bestätigung/);
  assert.throws(
    () =>
      parseMarketplacePublishRequest({ manifest: VALID_MANIFEST, confirmed: true, html: "<b>" }),
    /Bestätigung/,
  );
  assert.throws(
    () =>
      parseMarketplacePublishRequest({
        manifest: VALID_MANIFEST,
        confirmed: true,
        appId: "8c2e1891-c4da-4c12-a47d-9fb0bda5d712",
      }),
    /Versionsangabe/,
  );
  const version = parseMarketplacePublishRequest({
    manifest: VALID_MANIFEST,
    confirmed: true,
    appId: "8c2e1891-c4da-4c12-a47d-9fb0bda5d712",
    expectedVersion: 1,
  });
  assert.equal(version.expectedVersion, 1);
  assert.equal(version.appId, "8c2e1891-c4da-4c12-a47d-9fb0bda5d712");

  assert.doesNotMatch(authoringComponent, /publishConfirmationOpen|onConfirmPublish/);
  assert.match(miraChat, /confirmed: true as const/);
  assert.match(draftPreview, /role="group"/);
  assert.match(draftPreview, /onConfirmPublish/);
  assert.match(draftPreview, /Ja, veröffentlichen/);
  assert.match(authoringComponent, /open=\{revokeConfirmationApp !== null\}/);
  assert.match(appViewer, /pinned|unveränderlich/i);
});

test("the migration enforces admin-only RLS and does not grant direct table writes", () => {
  assert.match(migration, /ALTER TABLE public\.marketplace_apps ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.marketplace_app_versions ENABLE ROW LEVEL SECURITY/);
  assert.match(
    migration,
    /CREATE POLICY marketplace_admin_read_published_apps[\s\S]*?has_global_role\('admin'\)/,
  );
  assert.match(
    migration,
    /CREATE POLICY marketplace_admin_read_published_versions[\s\S]*?has_global_role\('admin'\)/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.marketplace_apps FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.marketplace_app_versions FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(migration, /GRANT SELECT ON TABLE public\.marketplace_apps TO authenticated/);
  assert.match(
    migration,
    /GRANT SELECT ON TABLE public\.marketplace_app_versions TO authenticated/,
  );
  assert.match(
    migration,
    /pg_catalog\.translate\(\s*p_text,[\s\S]*?pg_catalog\.chr\(8234\)[\s\S]*?pg_catalog\.chr\(8297\)[\s\S]*?\)\s*=\s*p_text/,
  );
  assert.doesNotMatch(
    migration,
    /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+public\.marketplace_(?:apps|app_versions)\s+TO\s+(?:authenticated|anon|PUBLIC)/i,
  );

  for (const readFunction of ["list_marketplace_current_apps", "get_marketplace_app_version"]) {
    const start = migration.indexOf(`FUNCTION public.${readFunction}`);
    const functionSql = migration.slice(start, start + 900);
    assert.match(functionSql, /SECURITY INVOKER/);
    assert.match(functionSql, /SET search_path = ''/);
    assert.match(functionSql, /app\.status = 'published'/);
  }
  for (const writeFunction of ["publish_marketplace_app", "revoke_marketplace_app"]) {
    const start = migration.indexOf(`FUNCTION public.${writeFunction}`);
    const functionSql = migration.slice(start, start + 2600);
    assert.match(functionSql, /SECURITY DEFINER/);
    assert.match(functionSql, /SET search_path = ''/);
    assert.match(functionSql, /has_global_role\('admin'\)/);
    assert.match(functionSql, /p_confirmed IS DISTINCT FROM TRUE/);
  }
  assert.match(migration, /created_by = auth\.uid\(\)/);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock\(741923,\s*1\)/);
  assert.match(
    migration,
    /count\(\*\)\s+FROM public\.marketplace_apps\s+WHERE status = 'published'\)\s+>= 500/,
  );
  assert.match(migration, /UPDATE OR DELETE ON public\.marketplace_app_versions/);
  assert.match(migration, /Marketplace app versions are immutable/);
});

test("revocation blocks reads/launches for every version and version updates are immutable and optimistic", () => {
  assert.match(migration, /WHERE app\.status = 'published'[\s\S]*?LIMIT 500/);
  assert.match(migration, /AND app\.status = 'published'[\s\S]*?LIMIT 1/);
  assert.match(
    migration,
    /WHERE id = p_app_id[\s\S]*?AND status = 'published'[\s\S]*?AND created_by = auth\.uid\(\)/,
  );
  assert.match(migration, /previous_version IS DISTINCT FROM p_expected_version/);
  assert.match(migration, /next_version := previous_version \+ 1/);
  assert.match(migration, /INSERT INTO public\.marketplace_app_versions/);
  assert.match(
    authoringComponent,
    /getAppVersion\(\{\s*data:\s*\{\s*appId:\s*app\.appId,\s*version:\s*installed\.version/,
  );
  assert.match(
    authoringComponent,
    /installMarketplacePublishedApp\(installState, checked\.appId, checked\.version,\s*\{/,
  );
  assert.match(
    authoringComponent,
    /updateMarketplacePublishedAppVersion\(installState,\s*app\.appId,\s*checked\.version,/,
  );
  assert.match(appViewer, /Diese App ist nicht mehr aktiv/);
  assert.match(authoringComponent, /<MarketplacePublishedAppViewer/);
  assert.doesNotMatch(authoringComponent, /<MarketplaceManifestView/);
  assert.match(appViewer, /isMarketplaceAdminAccessGranted\(access\)/);
  assert.match(appViewer, /installed\.permissionsReviewVersion === installedVersion/);
  assert.match(appViewer, /setMarketplacePublishedAppPermissions/);
  assert.match(appViewer, /getAppVersion\(\{ data: \{ appId, version: installedVersion \} \}\)/);
  assert.match(appViewer, /executeMarketplaceAppAction/);
  assert.match(appRuntime, /getMarketplaceAuthorAction\(request\.actionId\)/);
  assert.match(appRuntime, /findGrantedInstall/);
  assert.match(appRuntime, /assertCurrent\(\)/);
});

test("SQL action and icon allowlists exactly match the compiled host registry", () => {
  const actionBlock = migration.match(/action_id NOT IN \(([\s\S]*?)\n\s{6}\)/);
  assert.ok(actionBlock, "SQL must have an explicit action ID allowlist");
  const sqlActionIds = [...actionBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(sqlActionIds, MARKETPLACE_AUTHOR_ACTIONS.map(({ id }) => id).sort());

  const iconBlock = migration.match(/icon_name NOT IN \(([\s\S]*?)\n\s{2}\)/);
  assert.ok(iconBlock, "SQL must have an explicit icon allowlist");
  const sqlIcons = [...iconBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(sqlIcons, [...MARKETPLACE_ICON_IDS].sort());
});

test("v2 quiz migration is append-only, bounded and preserves the registered action/icon allowlists", () => {
  assert.match(gameMigration, /^BEGIN;[\s\S]*COMMIT;\s*$/);
  assert.match(gameMigration, /CREATE OR REPLACE FUNCTION public\.marketplace_quiz_game_is_valid/);
  assert.match(gameMigration, /CREATE OR REPLACE FUNCTION public\.marketplace_manifest_is_valid/);
  assert.match(gameMigration, /schema_version = 1/);
  assert.match(gameMigration, /schema_version = 2/);
  assert.match(gameMigration, /question_count < 3 OR question_count > 12/);
  assert.match(gameMigration, /choice_count < 2 OR choice_count > 4/);
  assert.match(gameMigration, /correct_index < 0 OR correct_index >= choice_count/);
  assert.match(gameMigration, /public\.marketplace_text_is_safe/);
  assert.match(gameMigration, /REVOKE ALL ON FUNCTION public\.marketplace_quiz_game_is_valid/);
  assert.match(gameMigration, /REVOKE ALL ON FUNCTION public\.marketplace_manifest_is_valid/);
  assert.doesNotMatch(
    gameMigration,
    /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|POLICY)\b|\bINSERT\s+INTO\b|\bUPDATE\s+public\.|\bDELETE\s+FROM\b/i,
  );

  const actionBlock = gameMigration.match(
    /action_id NOT IN \(([\s\S]*?)\) OR action_id = ANY\(action_ids\)/,
  );
  assert.ok(actionBlock, "v2 SQL must retain an explicit registered-action allowlist");
  const sqlActionIds = [...actionBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(sqlActionIds, MARKETPLACE_AUTHOR_ACTIONS.map(({ id }) => id).sort());

  const iconBlock = gameMigration.match(/icon_name NOT IN \(([\s\S]*?)\n\s{2}\)/);
  assert.ok(iconBlock, "v2 SQL must retain an explicit icon allowlist");
  const sqlIcons = [...iconBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(sqlIcons, [...MARKETPLACE_ICON_IDS].sort());
});

test("only the fixed renderer is used: no dynamic imports, remote URLs, executable code or auto-generation side effects", () => {
  for (const source of [serverFunctions, authoringComponent, appViewer, manifestRenderer, route]) {
    assert.doesNotMatch(
      source,
      /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\beval\s*\(|\bFunction\s*\(|dangerouslySetInnerHTML|\bimport\s*\(/,
    );
  }
  assert.doesNotMatch(manifestRenderer, /srcDoc|<script\b/i);
  assert.match(manifestRenderer, /block\.type === "heading"/);
  assert.match(manifestRenderer, /block\.type === "paragraph"/);
  assert.match(manifestRenderer, /block\.type === "list"/);
  assert.match(manifestRenderer, /getMarketplaceAuthorAction\(block\.actionId\)/);
  assert.match(manifestRenderer, /onAction\?\.\(block\.actionId\)/);
  assert.doesNotMatch(
    authoringComponent,
    /ADMIN-APP-BUILDER|marketplace-app-goal|Mit Mira entwerfen/,
  );
  assert.doesNotMatch(authoringComponent, /generateMarketplaceManifestDraft/);
  assert.match(miraChat, /classifyMarketplaceChatIntent/);
  assert.match(miraChat, /await checkMarketplaceAdmin\(\)/);
  assert.match(miraChat, /generateMarketplaceManifestDraft\(/);
  assert.match(miraChat, /confirmed: true as const/);
  assert.match(draftPreview, /role="group"/);
  assert.match(draftPreview, /Ja, veröffentlichen/);
  const effectBodies = authoringComponent
    .split("useEffect(() => {")
    .slice(1)
    .map((effect) => effect.split("}, [")[0]);
  assert.ok(effectBodies.some((effect) => effect.includes("listApps()")));
  assert.ok(effectBodies.every((effect) => !effect.includes("generateMarketplaceManifestDraft")));
  assert.match(route, /<MarketplaceCustomApps userId=\{userId\} isAdmin=\{isMarketplaceAdmin\}/);
  assert.match(route, /if \(!isMarketplaceAdmin\) return null/);
});

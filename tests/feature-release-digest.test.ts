import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  FEATURE_RELEASE_BODY_MAX,
  FEATURE_RELEASE_TITLE_MAX,
  isSafeFeatureDigestText,
  parseFeatureReleaseDigestRequest,
  parseFeatureReleaseDigestResult,
} from "../src/lib/feature-release-digest";

const root = process.cwd();
const migration = readFileSync(
  `${root}/supabase/migrations/20261107122500_postfach_feature_release_digest.sql`,
  "utf8",
);
const serverFunctions = readFileSync(`${root}/src/lib/marketplace.functions.ts`, "utf8");
const adminPanel = readFileSync(
  `${root}/src/components/admin/FeatureReleaseDigestPanel.tsx`,
  "utf8",
);
const postfachPage = readFileSync(`${root}/src/components/postfach/PostfachPage.tsx`, "utf8");
const ciWorkflow = readFileSync(`${root}/.github/workflows/ci.yml`, "utf8");
const supabaseConfig = readFileSync(`${root}/supabase/config.toml`, "utf8");

const validRequest = {
  releaseKey: "2026-11-mira-workbench",
  title: "Mira-Werkbank",
  body: "Zehn neue Aufgaben sind im Mira-Chat verfügbar.",
  confirmed: true,
};

const validResult = {
  release_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  was_created: true,
  recipient_count: 12,
};

test("digest request accepts only a unique lowercase release key, safe text and explicit confirmation", () => {
  assert.deepEqual(parseFeatureReleaseDigestRequest(validRequest), validRequest);
  assert.deepEqual(
    parseFeatureReleaseDigestRequest({ ...validRequest, title: "  Titel  ", body: " Text " }),
    { ...validRequest, title: "Titel", body: "Text" },
  );
  assert.throws(() => parseFeatureReleaseDigestRequest({ ...validRequest, confirmed: false }));
  assert.throws(() => parseFeatureReleaseDigestRequest({ ...validRequest, extra: "recipient" }));
  assert.throws(() =>
    parseFeatureReleaseDigestRequest({ ...validRequest, releaseKey: "2026-11-Mira" }),
  );
  assert.throws(() => parseFeatureReleaseDigestRequest({ ...validRequest, releaseKey: "a" }));
  assert.throws(() =>
    parseFeatureReleaseDigestRequest({ ...validRequest, title: "<b>Update</b>" }),
  );
  assert.throws(() =>
    parseFeatureReleaseDigestRequest({ ...validRequest, body: "https://example.test" }),
  );
  assert.throws(() =>
    parseFeatureReleaseDigestRequest({
      ...validRequest,
      body: "x".repeat(FEATURE_RELEASE_BODY_MAX + 1),
    }),
  );
});

test("digest text guard rejects control and bidirectional override characters", () => {
  assert.equal(isSafeFeatureDigestText("Alo-Update", FEATURE_RELEASE_TITLE_MAX), true);
  assert.equal(isSafeFeatureDigestText("Text\nmit Zeilenumbruch", FEATURE_RELEASE_BODY_MAX), false);
  assert.equal(isSafeFeatureDigestText("Text\u202eumgedreht", FEATURE_RELEASE_BODY_MAX), false);
});

test("RPC result parser fails closed on malformed or contradictory delivery metadata", () => {
  assert.deepEqual(parseFeatureReleaseDigestResult([validResult]), {
    releaseId: validResult.release_id,
    wasCreated: true,
    recipientCount: 12,
  });
  assert.deepEqual(
    parseFeatureReleaseDigestResult({ ...validResult, was_created: false, recipient_count: 0 }),
    { releaseId: validResult.release_id, wasCreated: false, recipientCount: 0 },
  );
  assert.throws(() => parseFeatureReleaseDigestResult({ ...validResult, extra: "user_ids" }));
  assert.throws(() =>
    parseFeatureReleaseDigestResult({ ...validResult, was_created: false, recipient_count: 1 }),
  );
});

test("database migration is atomic, keeps per-user Postfach rows and grants no direct table writes", () => {
  assert.match(migration, /^BEGIN;[\s\S]*COMMIT;\s*$/);
  assert.match(migration, /'feature_release'/);
  assert.match(migration, /CREATE TABLE public\.feature_release_digests/);
  assert.match(migration, /release_key text NOT NULL UNIQUE/);
  assert.match(migration, /CREATE TABLE public\.feature_release_digest_deliveries/);
  assert.match(migration, /PRIMARY KEY \(release_id, user_id\)/);
  assert.match(migration, /ALTER TABLE public\.feature_release_digests ENABLE ROW LEVEL SECURITY/);
  assert.match(
    migration,
    /ALTER TABLE public\.feature_release_digest_deliveries ENABLE ROW LEVEL SECURITY/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.feature_release_digests FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.feature_release_digest_deliveries FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(
    migration,
    /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL|SELECT)\s+ON\s+TABLE\s+public\.(?:feature_release_digests|feature_release_digest_deliveries|postfach_items)\s+TO\s+(?:authenticated|anon|PUBLIC)/i,
  );
  assert.doesNotMatch(migration, /CREATE POLICY|DROP POLICY/i);

  const writerStart = migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.publish_feature_release_digest",
  );
  assert.notEqual(writerStart, -1);
  const writer = migration.slice(writerStart);
  assert.match(writer, /SECURITY DEFINER/);
  assert.match(writer, /SET search_path = ''/);
  assert.match(writer, /public\.has_global_role\('admin'\)/);
  assert.match(writer, /p_confirmed IS DISTINCT FROM TRUE/);
  assert.match(writer, /COALESCE\(account\.is_anonymous, false\) IS FALSE/);
  assert.match(writer, /FROM auth\.users AS account/);
  assert.match(writer, /ON CONFLICT \(release_id, user_id\) DO NOTHING/);
  assert.match(writer, /ON CONFLICT \(user_id, kind, ref_id\) WHERE ref_id IS NOT NULL DO NOTHING/);
  assert.doesNotMatch(writer, /p_user_id|p_recipient|p_user_ids/i);
  assert.match(
    writer,
    /REVOKE ALL ON FUNCTION public\.publish_feature_release_digest\(text, text, text, boolean\)[\s\S]*?FROM PUBLIC, anon, service_role/,
  );
  assert.match(
    writer,
    /GRANT EXECUTE ON FUNCTION public\.publish_feature_release_digest\(text, text, text, boolean\)\s+TO authenticated/,
  );
});

test("server and Admin UI re-check Admin access and require a visible, explicit digest confirmation", () => {
  const start = serverFunctions.indexOf(
    "export const publishFeatureReleaseDigest = createServerFn",
  );
  assert.notEqual(start, -1);
  const end = serverFunctions.indexOf("export const listMarketplaceCurrentApps", start);
  const serverFunction = serverFunctions.slice(start, end);
  assert.match(serverFunction, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(serverFunction, /await requireMarketplaceAdmin\(context as ServerAuthContext\)/);
  assert.match(serverFunction, /p_confirmed: data\.confirmed/);
  assert.match(adminPanel, /<AlertDialog/);
  assert.match(adminPanel, /Ein Eintrag pro aktuell registriertem, nicht anonymem Konto/);
  assert.match(adminPanel, /Keine E-Mail- oder/);
  assert.match(adminPanel, /<p className="font-semibold text-foreground">\{title\.trim\(\)\}/);
  assert.match(
    adminPanel,
    /<p className="whitespace-pre-wrap text-muted-foreground">\{body\.trim\(\)\}/,
  );
  assert.match(adminPanel, /aria-live="assertive"/);
  assert.match(adminPanel, /publishDigest\(/);
  assert.doesNotMatch(adminPanel, /useEffect\(/);
});

test("Postfach digest content wraps long words and nearby controls meet mobile touch sizing", () => {
  assert.match(postfachPage, /\[overflow-wrap:anywhere\]/);
  assert.match(postfachPage, /min-h-11 shrink-0 items-center rounded-full/);
  assert.match(postfachPage, /min-h-11 rounded-full border px-3 py-2/);
});

test("tracked GitHub CI and Supabase project config do not apply migrations", () => {
  assert.match(ciWorkflow, /npm run lint/);
  assert.match(ciWorkflow, /npm test/);
  assert.match(ciWorkflow, /npm run build/);
  assert.doesNotMatch(ciWorkflow, /supabase\s+(?:db\s+push|migration\s+up|migrations\s+apply)/i);
  assert.match(supabaseConfig, /\[db\.migrations\][\s\S]*?enabled = false/);
  assert.match(supabaseConfig, /\[db\.seed\][\s\S]*?enabled = false/);
});

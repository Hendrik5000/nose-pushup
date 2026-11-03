import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  resolveSupabaseBackendScope,
  scopedStorageKey,
} from "../src/integrations/supabase/backendScope";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("backend scope resolves only a consistent public project ID and URL", () => {
  assert.equal(
    resolveSupabaseBackendScope({
      projectId: "dbnlybjlswuvxrccgqah",
      url: "https://dbnlybjlswuvxrccgqah.supabase.co",
    }),
    "supabase:dbnlybjlswuvxrccgqah",
  );
  assert.equal(
    resolveSupabaseBackendScope({ url: "https://dbnlybjlswuvxrccgqah.supabase.co" }),
    "supabase:dbnlybjlswuvxrccgqah",
  );
  assert.equal(
    resolveSupabaseBackendScope({
      projectId: "dbnlybjlswuvxrccgqah",
      url: "https://nyxojeadroaxixdxczsa.supabase.co",
    }),
    null,
  );
  assert.equal(resolveSupabaseBackendScope({ projectId: "not a project id" }), null);
  assert.equal(resolveSupabaseBackendScope({}), null);
});

test("local workspace and preference keys are isolated by both backend and account", () => {
  const legacy = "alo-workspace-v1:account-a";
  const oldBackend = scopedStorageKey("alo-workspace", "account-a", "supabase:old");
  const rebuild = scopedStorageKey("alo-workspace", "account-a", "supabase:rebuild");
  const otherAccount = scopedStorageKey("alo-workspace", "account-b", "supabase:old");

  assert.notEqual(oldBackend, legacy);
  assert.notEqual(oldBackend, rebuild);
  assert.notEqual(oldBackend, otherAccount);
  assert.match(oldBackend, /^alo-workspace:v2:/);
  assert.match(
    source("src/lib/alo-store.ts"),
    /Historical v1 entries have no verified\s*\/\/ backend provenance/,
  );
  assert.match(source("src/lib/alo-sync.ts"), /!SUPABASE_BACKEND_SCOPE \|\| !cloudEnabled\(id\)/);
});

test("offline queue uses a new per-backend database and refuses unknown queue entries", () => {
  const queue = source("src/lib/offline-queue.ts");
  assert.match(queue, /nosy-offline-v2:\$\{SUPABASE_BACKEND_SCOPE\}/);
  assert.match(queue, /backend_scope: SUPABASE_BACKEND_SCOPE/);
  assert.match(queue, /item\.backend_scope === SUPABASE_BACKEND_SCOPE/);
  assert.match(
    queue,
    /item\.backend_scope !== SUPABASE_BACKEND_SCOPE \|\| item\.row\.user_id !== data\.user\.id/,
  );
  assert.match(
    queue,
    /nosy-offline.*legacy data of unknown origin[\s\S]*Never open,[\s\S]*migrate, clear or flush it automatically/,
  );
  assert.doesNotMatch(queue, /indexedDB\.open\(["']nosy-offline["']/);
});

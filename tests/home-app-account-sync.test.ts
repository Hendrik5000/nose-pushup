import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  homeAppSyncBaselineStorageKey,
  parseHomeAppSyncRecords,
  planHomeAppAccountSync,
  projectHomeAppSyncValues,
  synchronizeHomeAppAccount,
  mergeHomeAppLocalEdit,
  mergeMarketplaceLocalEdit,
  type HomeAppSyncBackend,
  type HomeAppSyncRecord,
  type HomeAppSyncValue,
  type HomeAppSyncContext,
} from "@/lib/home-app-account-sync";
import {
  EMPTY_HOME_APP_HUB_SETTINGS,
  loadHomeAppHubSettings,
  saveHomeAppHubSettings,
  setHomeAppName,
  clearHomeAppName,
  homeAppHubSettingsStorageKey,
} from "@/lib/home-app-hub";
import {
  EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  loadMarketplacePublishedInstallState,
  parseMarketplacePublishedInstallState,
  saveMarketplacePublishedInstallState,
} from "@/lib/marketplace-authoring";

const ID = "2e8c4f90-071f-4ba4-b294-d0b8aa412404";
const FOREIGN = "3e8c4f90-071f-4ba4-b294-d0b8aa412405";
const USER = "user-a";
class MemoryStorage {
  entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}
const key = (r: Pick<HomeAppSyncValue, "kind" | "app_key">) => `${r.kind}:${r.app_key}`;
function name(value: string | null, revision = 1): HomeAppSyncRecord {
  return {
    kind: "home_name",
    app_key: "mira",
    name: value,
    version: null,
    enabled: null,
    deleted: value === null,
    revision,
  };
}
function install(version: number | null = 1, revision = 1): HomeAppSyncRecord {
  return {
    kind: "marketplace_install",
    app_key: `marketplace:${ID}`,
    name: null,
    version,
    enabled: version === null ? null : true,
    deleted: version === null,
    revision,
  };
}
function server(initial: HomeAppSyncRecord[] = []) {
  const rows = new Map(initial.map((r) => [key(r), r]));
  const writes: HomeAppSyncValue[] = [];
  const context = (): HomeAppSyncContext => ({
    records: [...rows.values()],
    ownedAppIds: [ID],
    metadata: {
      [`${ID}:1`]: { manifestName: "Meine App", icon: "mira" },
      [`${ID}:2`]: { manifestName: "Meine App 2", icon: "mira" },
    },
  });
  const backend: HomeAppSyncBackend = {
    checkIdentity: async () => true,
    read: async () => context(),
    write: async (value, expected) => {
      writes.push(value);
      const current = rows.get(key(value));
      if ((current?.revision ?? 0) !== expected) return null;
      const result = { ...value, revision: expected + 1 };
      rows.set(key(value), result);
      return result;
    },
  };
  return { rows, writes, context, backend };
}
function local(storage: MemoryStorage) {
  return {
    settings: loadHomeAppHubSettings(storage, USER),
    installs: loadMarketplacePublishedInstallState(storage, USER),
  };
}
function saveInstall(storage: MemoryStorage, version = 1, grants = false, appId = ID) {
  saveMarketplacePublishedInstallState(storage, USER, {
    schemaVersion: 1,
    installs: [
      {
        appId,
        version,
        enabled: true,
        manifestName: "Meine App",
        icon: "mira",
        ...(grants ? { permissionsReviewVersion: version, grantedActionIds: ["route:/ai"] } : {}),
      },
    ],
  });
}

test("strict remote whitelist rejects permissions, settings, duplicate keys and invalid shapes", () => {
  assert.deepEqual(parseHomeAppSyncRecords([name("Meine Mira")]), [name("Meine Mira")]);
  for (const extra of [
    "grantedActionIds",
    "permissionsReviewVersion",
    "order",
    "background",
    "user_id",
  ]) {
    assert.throws(() => parseHomeAppSyncRecords([{ ...name("Mira"), [extra]: [] }]));
  }
  assert.throws(() => parseHomeAppSyncRecords([name("<script>")]));
  assert.throws(() => parseHomeAppSyncRecords([{ ...install(), version: null }]));
  assert.throws(() => parseHomeAppSyncRecords([{ ...install(), app_key: "mira" }]));
  assert.throws(() => parseHomeAppSyncRecords([name("Mira"), name("Mira")]));
  assert.throws(() => parseHomeAppSyncRecords([name("Mira", 0)]));
  assert.throws(() => parseHomeAppSyncRecords(Array.from({ length: 513 }, () => name("Mira"))));
});

test("two devices share names and own installation/activation/version but never local appearance or action consent", async () => {
  const a = new MemoryStorage(),
    b = new MemoryStorage(),
    cloud = server();
  saveHomeAppHubSettings(
    a,
    USER,
    setHomeAppName(EMPTY_HOME_APP_HUB_SETTINGS, "mira", "Meine Mira"),
  );
  saveInstall(a, 1, true);
  saveHomeAppHubSettings(b, USER, {
    ...EMPTY_HOME_APP_HUB_SETTINGS,
    order: ["training", "mira"],
    background: { kind: "custom" },
  });
  await synchronizeHomeAppAccount(a, USER, cloud.backend);
  await synchronizeHomeAppAccount(b, USER, cloud.backend);
  assert.equal(local(b).settings.nameOverrides.mira, "Meine Mira");
  assert.deepEqual(local(b).settings.order, ["training", "mira"]);
  assert.deepEqual(local(b).settings.background, { kind: "custom" });
  assert.equal(local(b).installs.installs[0]?.manifestName, "Meine App");
  assert.equal(local(b).installs.installs[0]?.enabled, true);
  assert.equal(local(b).installs.installs[0]?.permissionsReviewVersion, undefined);
  assert.equal(local(b).installs.installs[0]?.grantedActionIds, undefined);
  assert.equal(local(a).installs.installs[0]?.permissionsReviewVersion, 1);
  for (const value of cloud.writes)
    assert.deepEqual(Object.keys(value).sort(), [
      "app_key",
      "deleted",
      "enabled",
      "kind",
      "name",
      "version",
    ]);
  assert.notEqual(homeAppSyncBaselineStorageKey(USER), homeAppSyncBaselineStorageKey("user-b"));
  assert.deepEqual(loadHomeAppHubSettings(b, "user-b"), EMPTY_HOME_APP_HUB_SETTINGS);
});

test("same-version local consent survives remote activation, but a new version and reinstallation require fresh consent", async () => {
  const storage = new MemoryStorage(),
    cloud = server([install()]);
  saveInstall(storage, 1, true);
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  cloud.rows.set(key(install()), { ...install(1, 2), enabled: false });
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(local(storage).installs.installs[0]?.permissionsReviewVersion, 1);
  cloud.rows.set(key(install()), install(2, 3));
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(local(storage).installs.installs[0]?.version, 2);
  assert.equal(local(storage).installs.installs[0]?.permissionsReviewVersion, undefined);
  assert.equal(local(storage).installs.installs[0]?.grantedActionIds, undefined);
  cloud.rows.set(key(install()), install(null, 4));
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(local(storage).installs.installs.length, 0);
  cloud.rows.set(key(install()), install(2, 5));
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(local(storage).installs.installs[0]?.grantedActionIds, undefined);
});

test("rename reset and uninstall tombstones propagate without changing the other device's order/background", async () => {
  const a = new MemoryStorage(),
    b = new MemoryStorage(),
    cloud = server([name("X"), install()]);
  await synchronizeHomeAppAccount(a, USER, cloud.backend);
  await synchronizeHomeAppAccount(b, USER, cloud.backend);
  saveHomeAppHubSettings(a, USER, clearHomeAppName(local(a).settings, "mira"));
  saveMarketplacePublishedInstallState(a, USER, EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE);
  await synchronizeHomeAppAccount(a, USER, cloud.backend);
  await synchronizeHomeAppAccount(b, USER, cloud.backend);
  assert.equal(local(b).settings.nameOverrides.mira, undefined);
  assert.equal(local(b).installs.installs.length, 0);
  assert.equal(cloud.rows.get(key(name(null)))?.deleted, true);
  assert.equal(cloud.rows.get(key(install(null)))?.deleted, true);
  const old = new MemoryStorage();
  saveInstall(old);
  await synchronizeHomeAppAccount(old, USER, cloud.backend);
  assert.equal(
    local(old).installs.installs.length,
    0,
    "stale first-use device must not resurrect a tombstone",
  );
});

test("foreign apps, their names, appearance and permission-only changes are never uploaded", async () => {
  const storage = new MemoryStorage(),
    cloud = server();
  saveInstall(storage, 1, false, FOREIGN);
  saveHomeAppHubSettings(storage, USER, {
    ...EMPTY_HOME_APP_HUB_SETTINGS,
    order: ["training"],
    background: { kind: "preset", presetId: "ocean" },
    nameOverrides: { [`marketplace:${FOREIGN}`]: "Fremd" },
  });
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(cloud.writes.length, 0);
  assert.equal(local(storage).installs.installs[0]?.appId, FOREIGN);
  assert.equal(local(storage).settings.nameOverrides[`marketplace:${FOREIGN}`], "Fremd");
  const projected = projectHomeAppSyncValues(local(storage), new Set([ID]));
  assert.deepEqual(projected, []);
});

test("failed first fetch retains a durable seed; later explicit offline edits win over the account copy", async () => {
  const storage = new MemoryStorage(),
    cloud = server([name("Konto")]);
  await assert.rejects(
    synchronizeHomeAppAccount(storage, USER, {
      ...cloud.backend,
      read: async () => {
        throw new Error("offline");
      },
    }),
  );
  saveHomeAppHubSettings(
    storage,
    USER,
    setHomeAppName(local(storage).settings, "mira", "Offline geändert"),
  );
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(cloud.rows.get(key(name("")))?.name, "Offline geändert");
  assert.equal(local(storage).settings.nameOverrides.mira, "Offline geändert");
});

test("initial nonempty local conflicts adopt the account copy; unrelated local keys are imported", async () => {
  const storage = new MemoryStorage(),
    cloud = server([name("Konto")]);
  saveHomeAppHubSettings(storage, USER, {
    ...EMPTY_HOME_APP_HUB_SETTINGS,
    nameOverrides: { mira: "Alt lokal", nexus: "Mein Chat" },
  });
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(local(storage).settings.nameOverrides.mira, "Konto");
  assert.equal(cloud.rows.get("home_name:nexus")?.name, "Mein Chat");
});

test("CAS conflict stays pending without clobbering local intent and succeeds after a fresh merge", async () => {
  const storage = new MemoryStorage(),
    cloud = server([name("A")]);
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  saveHomeAppHubSettings(storage, USER, setHomeAppName(local(storage).settings, "mira", "Lokal"));
  const first = await synchronizeHomeAppAccount(storage, USER, {
    ...cloud.backend,
    write: async () => {
      cloud.rows.set(key(name("")), name("Parallel", 2));
      return null;
    },
  });
  assert.equal(first.pending, 1);
  assert.equal(local(storage).settings.nameOverrides.mira, "Lokal");
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(cloud.rows.get(key(name("")))?.name, "Lokal");
  assert.equal(cloud.rows.get(key(name("")))?.revision, 3);
});

test("an edit during write acknowledgement is retained for the next sync", async () => {
  const storage = new MemoryStorage(),
    cloud = server();
  saveHomeAppHubSettings(storage, USER, setHomeAppName(local(storage).settings, "mira", "Eins"));
  await synchronizeHomeAppAccount(storage, USER, {
    ...cloud.backend,
    write: async (value, revision) => {
      const result = await cloud.backend.write(value, revision);
      saveHomeAppHubSettings(
        storage,
        USER,
        setHomeAppName(local(storage).settings, "mira", "Zwei"),
      );
      return result;
    },
  });
  assert.equal(local(storage).settings.nameOverrides.mira, "Zwei");
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(cloud.rows.get(key(name("")))?.name, "Zwei");
});

test("account switches, corrupt local JSON and malformed remote rows never replace valid local preferences", async () => {
  const storage = new MemoryStorage(),
    cloud = server([name("Remote")]);
  saveHomeAppHubSettings(storage, USER, setHomeAppName(local(storage).settings, "mira", "Lokal"));
  let active = true;
  const result = await synchronizeHomeAppAccount(
    storage,
    USER,
    {
      ...cloud.backend,
      read: async () => {
        active = false;
        return cloud.context();
      },
    },
    () => active,
  );
  assert.equal(result.cancelled, true);
  assert.equal(local(storage).settings.nameOverrides.mira, "Lokal");
  assert.equal(cloud.writes.length, 0);
  await assert.rejects(
    synchronizeHomeAppAccount(storage, USER, {
      ...cloud.backend,
      read: async () => ({
        ...cloud.context(),
        records: [{ ...name("X"), order: [] }] as unknown as HomeAppSyncRecord[],
      }),
    }),
  );
  assert.equal(local(storage).settings.nameOverrides.mira, "Lokal");
  storage.setItem(homeAppHubSettingsStorageKey(USER), "{corrupt");
  await assert.rejects(synchronizeHomeAppAccount(storage, USER, cloud.backend));
  assert.equal(storage.getItem(homeAppHubSettingsStorageKey(USER)), "{corrupt");
});

test("remote metadata cannot smuggle permissions and stale UI edits preserve unrelated current fields", () => {
  const empty = {
    settings: EMPTY_HOME_APP_HUB_SETTINGS,
    installs: EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  };
  const context = server([install()]).context();
  const malicious = {
    ...context,
    metadata: {
      [`${ID}:1`]: {
        manifestName: "X",
        icon: "mira",
        grantedActionIds: ["route:/ai"],
        permissionsReviewVersion: 1,
      },
    },
  } as unknown as HomeAppSyncContext;
  const plan = planHomeAppAccountSync(empty, [], malicious);
  assert.equal(plan.installs.installs[0]?.permissionsReviewVersion, undefined);
  const latest = setHomeAppName(EMPTY_HOME_APP_HUB_SETTINGS, "nexus", "Remote Chat");
  const next = setHomeAppName(EMPTY_HOME_APP_HUB_SETTINGS, "mira", "Lokal");
  assert.deepEqual(mergeHomeAppLocalEdit(EMPTY_HOME_APP_HUB_SETTINGS, next, latest).nameOverrides, {
    nexus: "Remote Chat",
    mira: "Lokal",
  });
  const previous = parseMarketplacePublishedInstallState({
    schemaVersion: 1,
    installs: [{ appId: ID, version: 1, enabled: false }],
  });
  const toggled = parseMarketplacePublishedInstallState({
    schemaVersion: 1,
    installs: [{ appId: ID, version: 1, enabled: true }],
  });
  const newer = parseMarketplacePublishedInstallState({
    schemaVersion: 1,
    installs: [{ appId: ID, version: 2, enabled: false }],
  });
  assert.throws(() => mergeMarketplaceLocalEdit(previous, toggled, newer), /inzwischen/);
});

test("migration is transactional, user-bound, SELECT-only RLS with narrow ownership/version checked CAS RPC", () => {
  const sql = readFileSync("supabase/migrations/20261107182500_home_app_account_sync.sql", "utf8");
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FOR SELECT TO authenticated/);
  assert.match(sql, /user_id = \(SELECT auth\.uid\(\)\)/);
  assert.doesNotMatch(sql, /FOR (INSERT|UPDATE|DELETE|ALL) TO authenticated/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /v_user UUID := auth\.uid\(\)/);
  assert.match(sql, /app\.created_by = v_user AND app\.status = 'published'/);
  assert.match(sql, /av\.version = p_version/);
  assert.match(sql, /v_existing\.revision <> p_expected_revision/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /version IS NOT NULL AND version > 0/);
  assert.match(sql, />= \(CASE WHEN p_kind = 'home_name' THEN 128 ELSE 100 END\) THEN/);
  assert.doesNotMatch(sql.replace(/ON DELETE CASCADE/g, ""), /\b(?:DELETE|DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /ALTER TABLE public\.(?!home_app_sync_records)/);
  assert.doesNotMatch(sql, /INSERT INTO public\.(?!home_app_sync_records)/);
  const columns = sql.slice(sql.indexOf("CREATE TABLE"), sql.indexOf("ALTER TABLE"));
  assert.doesNotMatch(
    columns,
    /grantedActionIds|permissionsReviewVersion|background\s|order\s|manifest\s+JSON/i,
  );
});

test("Home and Marketplace use guarded event-driven reconciliation, not polling or getUser calls", () => {
  const hook = readFileSync("src/hooks/use-home-app-account-sync.ts", "utf8");
  const home = readFileSync("src/routes/_authenticated/index.tsx", "utf8");
  const marketplace = readFileSync("src/components/marketplace/MarketplaceCustomApps.tsx", "utf8");
  for (const event of ["focus", "online", "visibilitychange"])
    assert.ok(hook.includes(`"${event}"`));
  assert.match(hook, /onAuthStateChange/);
  assert.doesNotMatch(hook, /setInterval|\.getUser\(/);
  for (const source of [home, marketplace]) {
    assert.match(source, /useHomeAppAccountSync/);
    assert.match(source, /HOME_APP_SYNC_APPLIED/);
    assert.match(source, /requestHomeAppAccountSync/);
    assert.match(source, /activeUserIdRef\.current/);
  }
  const viewer = readFileSync(
    "src/components/marketplace/MarketplacePublishedAppViewer.tsx",
    "utf8",
  );
  assert.match(viewer, /permissionsReviewVersion === installedVersion/);
  assert.match(viewer, /executeMarketplaceAppAction/);
  const runtime = readFileSync("src/lib/marketplace-runtime.ts", "utf8");
  assert.match(runtime, /grantedActionIds\?\.includes\(request\.actionId\)/);
});

test("simultaneous first imports converge on the first accepted account value without revision-zero DB rows", async () => {
  const a = new MemoryStorage(),
    b = new MemoryStorage(),
    cloud = server();
  saveHomeAppHubSettings(
    a,
    USER,
    setHomeAppName(EMPTY_HOME_APP_HUB_SETTINGS, "mira", "Erster Import"),
  );
  saveHomeAppHubSettings(
    b,
    USER,
    setHomeAppName(EMPTY_HOME_APP_HUB_SETTINGS, "mira", "Zweiter Import"),
  );
  await synchronizeHomeAppAccount(a, USER, cloud.backend);
  const staleRead = { ...cloud.context(), records: [] };
  const conflict = await synchronizeHomeAppAccount(b, USER, {
    ...cloud.backend,
    read: async () => staleRead,
  });
  assert.equal(conflict.pending, 1);
  await synchronizeHomeAppAccount(b, USER, cloud.backend);
  assert.equal(local(b).settings.nameOverrides.mira, "Erster Import");
  assert.equal(cloud.rows.get(key(name("")))?.revision, 1);
});

test("an explicit uninstall after a failed first fetch is retained and sends a tombstone", async () => {
  const storage = new MemoryStorage(),
    cloud = server([install()]);
  saveInstall(storage);
  await assert.rejects(
    synchronizeHomeAppAccount(storage, USER, {
      ...cloud.backend,
      read: async () => {
        throw new Error("offline");
      },
    }),
  );
  saveMarketplacePublishedInstallState(storage, USER, EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE);
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(cloud.rows.get(key(install()))?.deleted, true);
  assert.equal(local(storage).installs.installs.length, 0);
});

test("remote apply preserves unrelated local fields updated after the planner snapshot", async () => {
  const storage = new MemoryStorage(),
    cloud = server([name("Alt")]);
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  cloud.rows.set(key(name("")), name("Remote neu", 2));
  let injected = false;
  const concurrent: Pick<Storage, "getItem" | "setItem"> = {
    getItem: (k) => {
      if (!injected && k === homeAppSyncBaselineStorageKey(USER)) {
        injected = true;
        saveHomeAppHubSettings(storage, USER, {
          ...local(storage).settings,
          order: ["training", "mira"],
          nameOverrides: { ...local(storage).settings.nameOverrides, nexus: "Parallel lokal" },
        });
      }
      return storage.getItem(k);
    },
    setItem: (k, v) => storage.setItem(k, v),
  };
  // The first baseline existence check is before network/readLocal; inject specifically during readBaseline.
  let checks = 0;
  const originalGet = concurrent.getItem;
  concurrent.getItem = (k) => {
    if (k === homeAppSyncBaselineStorageKey(USER) && ++checks === 1) return storage.getItem(k);
    return originalGet(k);
  };
  await synchronizeHomeAppAccount(concurrent, USER, cloud.backend);
  assert.equal(local(storage).settings.nameOverrides.mira, "Remote neu");
  assert.equal(local(storage).settings.nameOverrides.nexus, "Parallel lokal");
  assert.deepEqual(local(storage).settings.order, ["training", "mira"]);
  await synchronizeHomeAppAccount(storage, USER, cloud.backend);
  assert.equal(cloud.rows.get("home_name:nexus")?.name, "Parallel lokal");
});

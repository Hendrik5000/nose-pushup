import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { homeAppHubSettingsStorageKey } from "@/lib/home-app-hub";
import {
  HOME_APP_SYNC_APPLIED,
  HOME_APP_SYNC_REQUEST,
  HOME_APP_SYNC_MAX_RECORDS,
  homeAppSyncMetadataKey,
  parseHomeAppSyncRecords,
  synchronizeHomeAppAccount,
  type HomeAppSyncBackend,
  type HomeAppSyncMetadata,
} from "@/lib/home-app-account-sync";
import {
  marketplacePublishedInstallStorageKey,
  parseMarketplacePublishedInstallState,
} from "@/lib/marketplace-authoring";

const COLUMNS = "kind,app_key,name,version,enabled,deleted,revision";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createHomeAppSyncBackend(userId: string): HomeAppSyncBackend {
  const checkIdentity = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error("Anmeldung ist für den Kontoabgleich gerade nicht erreichbar.");
    if (data.session?.user.is_anonymous)
      throw new Error("Für den Geräteabgleich bitte mit einem Konto anmelden.");
    return data.session?.user.id === userId;
  };
  return {
    checkIdentity,
    read: async () => {
      const [remote, owned] = await Promise.all([
        supabase
          .from("home_app_sync_records" as never)
          .select(COLUMNS)
          .eq("user_id", userId)
          .limit(HOME_APP_SYNC_MAX_RECORDS + 1),
        supabase
          .from("marketplace_apps" as never)
          .select("id")
          .eq("created_by", userId)
          .eq("status", "published")
          .limit(513),
      ]);
      if (remote.error || owned.error)
        throw new Error("App-Kontoabgleich ist gerade nicht erreichbar.");
      const records = parseHomeAppSyncRecords(remote.data);
      const rawOwned: unknown = owned.data;
      if (
        !Array.isArray(rawOwned) ||
        rawOwned.length > 512 ||
        rawOwned.some((row) => !object(row) || typeof row.id !== "string" || !UUID.test(row.id))
      ) {
        throw new Error("App-Eigentümerreferenzen konnten nicht sicher geprüft werden.");
      }
      const ownedAppIds = rawOwned.map((row) => (row as { id: string }).id);
      const own = new Set(ownedAppIds);
      const installs = records.filter(
        (row) =>
          row.kind === "marketplace_install" && !row.deleted && own.has(row.app_key.slice(12)),
      );
      const metadata: Record<string, HomeAppSyncMetadata> = {};
      if (installs.length > 0) {
        // Read only name/icon from the existing immutable version, never copy manifests into sync storage.
        const filters = installs
          .map((row) => `and(app_id.eq.${row.app_key.slice(12)},version.eq.${row.version})`)
          .join(",");
        const result = await supabase
          .from("marketplace_app_versions" as never)
          .select("app_id,version,manifest_name:manifest->>name,icon:manifest->>icon")
          .or(filters)
          .limit(101);
        if (result.error || !Array.isArray(result.data))
          throw new Error("App-Namen konnten nicht sicher geladen werden.");
        const requested = new Set(
          installs.map((row) => homeAppSyncMetadataKey(row.app_key.slice(12), row.version!)),
        );
        for (const raw of result.data as unknown[]) {
          if (!object(raw)) throw new Error("Ungültige App-Metadaten.");
          const [checked] = parseMarketplacePublishedInstallState({
            schemaVersion: 1,
            installs: [
              {
                appId: raw.app_id,
                version: raw.version,
                enabled: false,
                manifestName: raw.manifest_name,
                icon: raw.icon,
              },
            ],
          }).installs;
          if (!checked?.manifestName || !checked.icon) throw new Error("Ungültige App-Metadaten.");
          const checkedKey = homeAppSyncMetadataKey(checked.appId, checked.version);
          if (!requested.has(checkedKey) || metadata[checkedKey])
            throw new Error("Unerwartete oder doppelte App-Metadaten.");
          metadata[checkedKey] = {
            manifestName: checked.manifestName,
            icon: checked.icon,
          };
        }
        if (
          installs.some(
            (row) => !metadata[homeAppSyncMetadataKey(row.app_key.slice(12), row.version!)],
          )
        ) {
          throw new Error("Eine synchronisierte App-Version ist nicht mehr verfügbar.");
        }
      }
      return { records, ownedAppIds, metadata };
    },
    write: async (value, expectedRevision) => {
      const { data, error } = await supabase.rpc(
        "write_home_app_sync_record" as never,
        {
          p_kind: value.kind,
          p_app_key: value.app_key,
          p_name: value.name,
          p_version: value.version,
          p_enabled: value.enabled,
          p_deleted: value.deleted,
          p_expected_revision: expectedRevision,
        } as never,
      );
      if (error)
        throw new Error("Änderung bleibt lokal gespeichert; Kontoabgleich noch ausstehend.");
      const rows = parseHomeAppSyncRecords(data);
      if (rows.length > 1) throw new Error("Ungültige App-Sync-Bestätigung.");
      return rows[0] ?? null;
    },
  };
}

/** Mount/focus/online/save only. No timer, provider, background AI or automatic action execution. */
export function useHomeAppAccountSync(userId: string, enabled = true) {
  const [message, setMessage] = useState("App-Kontoabgleich wird vorbereitet …");
  useEffect(() => {
    if (!enabled) {
      setMessage("");
      return;
    }
    let active = true;
    let running = false;
    let queued = false;
    let conflictRetries = 0;
    const backend = createHomeAppSyncBackend(userId);
    const run = async () => {
      if (!active) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      setMessage("App-Namen und eigene Apps werden mit deinem Konto abgeglichen …");
      try {
        const result = await synchronizeHomeAppAccount(
          window.localStorage,
          userId,
          backend,
          () => active,
        );
        if (!active) return;
        if (result.cancelled)
          setMessage("Kontoabgleich pausiert. Deine Änderungen bleiben lokal erhalten.");
        else if (result.pending > 0) {
          setMessage("Lokale Änderungen warten noch auf den Kontoabgleich.");
          if (conflictRetries < 1) {
            conflictRetries += 1;
            queued = true;
          }
        } else {
          conflictRetries = 0;
          setMessage("App-Namen und eigene Apps sind mit deinem Konto abgeglichen.");
        }
      } catch {
        if (active)
          setMessage(
            "Kontoabgleich gerade nicht verfügbar. Änderungen bleiben lokal; erneuter Versuch beim Öffnen, Zurückkehren oder Online-Wechsel.",
          );
      } finally {
        if (active)
          window.dispatchEvent(new CustomEvent(HOME_APP_SYNC_APPLIED, { detail: { userId } }));
        running = false;
        if (queued && active) {
          queued = false;
          void run();
        }
      }
    };
    const request = () => {
      conflictRetries = 0;
      void run();
    };
    const onRequest = (event: Event) => {
      if ((event as CustomEvent<{ userId?: string }>).detail?.userId === userId) request();
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === homeAppHubSettingsStorageKey(userId) ||
        event.key === marketplacePublishedInstallStorageKey(userId)
      )
        request();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") request();
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) active = false;
    });
    window.addEventListener(HOME_APP_SYNC_REQUEST, onRequest);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", request);
    window.addEventListener("online", request);
    document.addEventListener("visibilitychange", onVisibility);
    request();
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener(HOME_APP_SYNC_REQUEST, onRequest);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", request);
      window.removeEventListener("online", request);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, userId]);
  return message;
}

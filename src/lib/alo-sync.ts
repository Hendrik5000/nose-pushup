import { supabase } from "@/integrations/supabase/client";
import {
  cloudEnabled,
  getAloOwner,
  mergeRemote,
  readRecords,
  writeRecords,
  type CloudRecord,
} from "@/lib/alo-store";
export type SyncState = {
  phase: "local" | "syncing" | "saved" | "offline" | "error" | "conflict";
  message: string;
  at?: string;
};
export const SYNC_EVENT = "alo-sync-state";
let status: SyncState = { phase: "local", message: "Lokal · nur dieses Gerät" };
let running: Promise<void> | null = null;
export function getSyncState() {
  return status;
}
function report(next: SyncState) {
  status = next;
  window.dispatchEvent(new Event(SYNC_EVENT));
}
export function resetSyncState() {
  report({ phase: "local", message: "Lokal · nur dieses Gerät" });
}
async function pull(id: string) {
  const rows: CloudRecord[] = [];
  // Supabase defaults to a 1000-row cap. Explicit pagination must include tombstones.
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase
      .from("alo_records" as never)
      .select("id,kind,body,revision,deleted,updated_at")
      .eq("user_id", id)
      .order("id")
      .range(start, start + 499);
    if (error)
      throw new Error(
        "Cloud nicht verfügbar. Alo-Datenbankmigration prüfen; lokale Daten bleiben erhalten.",
      );
    const page = (data ?? []) as unknown as CloudRecord[];
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}
export async function syncAlo(id: string): Promise<void> {
  if (!cloudEnabled(id) || id !== getAloOwner()) {
    resetSyncState();
    return;
  }
  if (running) return running;
  running = (async () => {
    if (!navigator.onLine) {
      report({ phase: "offline", message: "Offline · Änderungen nur lokal vorgemerkt" });
      return;
    }
    report({ phase: "syncing", message: "Cloud-Abgleich läuft …" });
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.id !== id) throw new Error("Konto geändert. Abgleich abgebrochen.");
      const allowed = () => cloudEnabled(id) && id === getAloOwner();
      const remote = await pull(id);
      if (!allowed()) return;
      writeRecords(id, mergeRemote(readRecords(id), remote), true);
      for (const candidate of readRecords(id).filter((r) => r.dirty && !r.conflict)) {
        if (!allowed()) return;
        const { data, error } = await supabase.rpc(
          "alo_sync_record" as never,
          {
            p_id: candidate.id,
            p_kind: candidate.kind,
            p_body: candidate.body,
            p_deleted: candidate.deleted,
            p_revision: candidate.revision,
          } as never,
        );
        if (error)
          throw new Error("Cloud-Speichern fehlgeschlagen. Änderungen bleiben lokal vorgemerkt.");
        if (!allowed()) return;
        const saved = (data as unknown as CloudRecord[] | null)?.[0];
        if (!saved) {
          const latest = await pull(id);
          if (allowed()) writeRecords(id, mergeRemote(readRecords(id), latest), true);
          continue;
        }
        // A user may have typed while the network request was in flight. Acknowledge
        // only the exact submitted version; retain subsequent edits as dirty.
        const all = readRecords(id).map((current) => {
          if (current.id !== candidate.id) return current;
          const same =
            current.updatedAt === candidate.updatedAt &&
            current.deleted === candidate.deleted &&
            JSON.stringify(current.body) === JSON.stringify(candidate.body);
          return { ...current, revision: saved.revision, dirty: !same, conflict: undefined };
        });
        writeRecords(id, all, true);
      }
      if (!allowed()) return;
      const records = readRecords(id);
      const conflicts = records.filter((r) => r.conflict).length;
      report(
        conflicts
          ? {
              phase: "conflict",
              message: `${conflicts} Konflikt(e) · Version in Privatsphäre auswählen`,
            }
          : records.some((r) => r.dirty)
            ? { phase: "offline", message: "Weitere lokale Änderungen warten auf Abgleich" }
            : {
                phase: "saved",
                message: "Synchronisiert · Cloud + lokales Gerät",
                at: new Date().toISOString(),
              },
      );
    } catch (e) {
      report({
        phase: "error",
        message: e instanceof Error ? e.message : "Abgleich fehlgeschlagen. Lokal erhalten.",
      });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
export async function eraseCloudWorkspace(id: string) {
  // Caller stops automatic sync first and presents an explicit destructive confirmation.
  if (running) await running;
  const { data } = await supabase.auth.getUser();
  if (data.user?.id !== id) throw new Error("Konto geändert. Löschen abgebrochen.");
  const { error } = await supabase.rpc("alo_erase_workspace" as never);
  if (error) throw new Error("Cloud-Löschung fehlgeschlagen; lokale Daten wurden nicht gelöscht.");
  const rows = await pull(id);
  writeRecords(id, mergeRemote([], rows), true);
}
